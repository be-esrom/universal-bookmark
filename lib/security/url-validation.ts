import dns from "node:dns/promises";

/**
 * Thrown for any validation failure that should be shown to the user as a
 * clean message (never a stack trace).
 */
export class UrlValidationError extends Error {}

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "[::1]"]);

/**
 * Validates URL syntax and protocol only. Does not touch the network.
 * Call this before every fetch attempt, including after following a redirect,
 * since a redirect can point anywhere.
 */
export function parseAndValidateUrlSyntax(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UrlValidationError("That doesn't look like a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UrlValidationError("Only http and https URLs are supported.");
  }

  if (BLOCKED_HOSTNAMES.has(url.hostname.toLowerCase())) {
    throw new UrlValidationError("This URL can't be analyzed.");
  }

  return url;
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const [a, b] = parts;

  if (a === 0) return true; // "this network"
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata 169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (carrier-grade NAT)

  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  if (normalized === "::1") return true; // loopback
  if (normalized === "::") return true; // unspecified
  if (normalized.startsWith("fe80")) return true; // link-local
  if (/^fc[0-9a-f]{2}:|^fd[0-9a-f]{2}:/.test(normalized)) return true; // fc00::/7 unique local

  // IPv4-mapped IPv6 addresses (::ffff:a.b.c.d) — check the embedded IPv4.
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);

  return false;
}

/**
 * Resolves the hostname and rejects it if any resolved address is private,
 * loopback, link-local, or otherwise internal. This is the actual SSRF
 * guard — checking the hostname string alone is not enough, since a public
 * hostname can resolve to a private address (DNS rebinding).
 */
export async function assertHostnameResolvesPublicly(
  hostname: string
): Promise<void> {
  let addresses: { address: string; family: number }[];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new UrlValidationError("Couldn't resolve this URL's host.");
  }

  if (addresses.length === 0) {
    throw new UrlValidationError("Couldn't resolve this URL's host.");
  }

  for (const { address, family } of addresses) {
    if (family === 4 && isPrivateIPv4(address)) {
      console.warn("[url-validation] blocked private IPv4", { hostname });
      throw new UrlValidationError(
        "This URL points to a private network address and can't be analyzed."
      );
    }
    if (family === 6 && isPrivateIPv6(address)) {
      console.warn("[url-validation] blocked private IPv6", { hostname });
      throw new UrlValidationError(
        "This URL points to a private network address and can't be analyzed."
      );
    }
  }
}
