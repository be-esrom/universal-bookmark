import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  parseAndValidateUrlSyntax,
  assertHostnameResolvesPublicly,
  UrlValidationError,
} from "@/lib/security/url-validation";
import { extractMetadata } from "@/lib/extract/metadata";

// Needs the Node.js runtime (not Edge) for dns.lookup-based SSRF checks.
export const runtime = "nodejs";

const FETCH_TIMEOUT_MS = 10000;
const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2MB cap on downloaded HTML
const MAX_REDIRECTS = 5;
const MAX_FETCH_ATTEMPTS = 2; // one retry for transient network errors
const RETRY_DELAY_MS = 350;

const GENERIC_ERROR = "Couldn't analyze this webpage.";

/**
 * Server-side only development logging. Every field logged here is safe:
 * hostname, redirect target, upstream status, content-type, and error
 * type/message. Never log headers, cookies, credentials, or full response
 * bodies.
 */
function log(event: string, details: Record<string, unknown> = {}) {
  console.log(`[bookmarks/analyze] ${event}`, details);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Maps an upstream non-2xx status to a message that actually explains what
 * happened, instead of pretending extraction itself failed. */
function messageForUpstreamStatus(status: number): string {
  if (status === 403) {
    return "This website is blocking automated requests and can't be analyzed right now.";
  }
  if (status === 404) {
    return "That page couldn't be found.";
  }
  if (status === 429) {
    return "This website is rate-limiting requests right now. Try again in a moment.";
  }
  if (status >= 500) {
    return "This website is temporarily unavailable. Try again later.";
  }
  return `This website returned an error (${status}) and can't be analyzed.`;
}

/** A realistic browser-like header set. Some sites intermittently challenge
 * or block requests that look automated (a bare User-Agent + Accept is a
 * common tell); a fuller, standard header set reduces that. This still only
 * fetches and reads text — no JavaScript from the page is ever executed. */
function buildRequestHeaders(): HeadersInit {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };
}

async function fetchOnce(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: buildRequestHeaders(),
    });
  } finally {
    clearTimeout(timeout);
  }
}

/** Fetches a single hop, retrying once on transient network-level errors
 * (connection reset, DNS hiccup, etc). Does not retry on a successful HTTP
 * response, even a non-2xx one — those are handled by the caller. */
async function fetchWithRetry(url: string, hostname: string): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
    try {
      return await fetchOnce(url, FETCH_TIMEOUT_MS);
    } catch (err) {
      lastError = err;
      const timedOut = err instanceof Error && err.name === "AbortError";
      log("fetch_attempt_failed", {
        hostname,
        attempt,
        maxAttempts: MAX_FETCH_ATTEMPTS,
        timedOut,
        errorType: err instanceof Error ? err.name : typeof err,
        errorMessage: err instanceof Error ? err.message : String(err),
      });

      if (attempt < MAX_FETCH_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  throw lastError;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const rawUrl = (body as { url?: unknown } | null)?.url;
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return NextResponse.json({ error: "A URL is required." }, { status: 400 });
  }

  let currentUrl: URL;
  try {
    currentUrl = parseAndValidateUrlSyntax(rawUrl.trim());
  } catch (err) {
    const message = err instanceof UrlValidationError ? err.message : GENERIC_ERROR;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const originalUrl = currentUrl.toString();
  log("request_received", { hostname: currentUrl.hostname });

  let response: Response | undefined;

  try {
    let redirectCount = 0;

    // Manually follow redirects so every hop — not just the first URL — is
    // re-validated against the SSRF checks. A malicious or compromised
    // server could otherwise redirect to an internal address.
    while (true) {
      await assertHostnameResolvesPublicly(currentUrl.hostname);

      response = await fetchWithRetry(currentUrl.toString(), currentUrl.hostname);

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          log("redirect_missing_location", { hostname: currentUrl.hostname, status: response.status });
          throw new UrlValidationError(GENERIC_ERROR);
        }

        redirectCount += 1;
        if (redirectCount > MAX_REDIRECTS) {
          throw new UrlValidationError("Too many redirects.");
        }

        const nextUrl = new URL(location, currentUrl).toString();
        const nextParsed = parseAndValidateUrlSyntax(nextUrl);
        log("redirect", {
          from: currentUrl.hostname,
          to: nextParsed.hostname,
          status: response.status,
        });
        currentUrl = nextParsed;
        continue;
      }

      break;
    }

    if (!response) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") ?? "";
    log("upstream_response", {
      hostname: currentUrl.hostname,
      status: response.status,
      contentType,
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: messageForUpstreamStatus(response.status) },
        { status: 502 }
      );
    }

    // Some servers omit or misconfigure content-type; only reject when a
    // content-type is present and clearly isn't HTML, rather than requiring
    // an exact match.
    const looksLikeHtml = contentType === "" || contentType.includes("html");
    if (!looksLikeHtml) {
      return NextResponse.json(
        { error: "That URL doesn't appear to be a webpage." },
        { status: 415 }
      );
    }

    const html = await readBodyCapped(response, MAX_HTML_BYTES);

    const extracted = extractMetadata(html, originalUrl);

    if (!extracted.title) {
      log("no_title_extracted", { hostname: currentUrl.hostname });
      return NextResponse.json(
        { error: "Couldn't find any useful information on this webpage." },
        { status: 422 }
      );
    }

    log("success", { hostname: currentUrl.hostname, title: extracted.title });

    const now = new Date().toISOString();
    const bookmark = {
      id: randomUUID(),
      originalUrl,
      title: extracted.title,
      description: extracted.description,
      imageUrl: extracted.imageUrl,
      sourceName: extracted.sourceName,
      metadata: extracted.metadata,
      category: null,
      subcategory: null,
      tags: [],
      createdAt: now,
      updatedAt: now,
    };

    return NextResponse.json({ bookmark });
  } catch (err) {
    if (err instanceof UrlValidationError) {
      log("validation_error", { hostname: currentUrl.hostname, message: err.message });
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof Error && err.name === "AbortError") {
      log("timeout", { hostname: currentUrl.hostname });
      return NextResponse.json(
        { error: "The webpage took too long to respond." },
        { status: 504 }
      );
    }
    log("unexpected_error", {
      hostname: currentUrl.hostname,
      errorType: err instanceof Error ? err.name : typeof err,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    // Never leak internal error details/stack traces to the client.
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 502 });
  }
}

async function readBodyCapped(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    return response.text();
  }

  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf-8");
}
