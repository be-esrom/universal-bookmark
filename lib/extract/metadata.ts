import * as cheerio from "cheerio";

export interface ExtractedPage {
  title?: string;
  description?: string;
  imageUrl?: string;
  sourceName?: string;
  canonicalUrl?: string;
  faviconUrl?: string;
  /** Flexible structured fields, e.g. { team: "...", brand: "..." }. Only
   * ever populated with values actually found on the page — never guessed. */
  metadata: Record<string, string>;
}

function resolveUrl(maybeRelative: string | undefined, base: string): string | undefined {
  if (!maybeRelative) return undefined;
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return undefined;
  }
}

function cleanText(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Normalizes a human label like "Season" or "Product Season" into a
 * compact metadata key like "season". */
function normalizeKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

const GENERIC_LABELS_TO_IGNORE = new Set([
  "home",
  "menu",
  "search",
  "share",
  "related",
  "reviews",
  "description",
]);

export function extractMetadata(html: string, baseUrl: string): ExtractedPage {
  const $ = cheerio.load(html);

  const metaContent = (selectors: string[]): string | undefined => {
    for (const selector of selectors) {
      const val = $(selector).attr("content");
      const cleaned = cleanText(val);
      if (cleaned) return cleaned;
    }
    return undefined;
  };

  const title =
    metaContent(['meta[property="og:title"]', 'meta[name="twitter:title"]']) ??
    cleanText($("title").first().text()) ??
    cleanText($("h1").first().text());

  const description =
    metaContent([
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
      'meta[name="description"]',
    ]);

  const rawImage = metaContent([
    'meta[property="og:image"]',
    'meta[property="og:image:url"]',
    'meta[name="twitter:image"]',
  ]);
  const imageUrl = resolveUrl(rawImage, baseUrl);

  const sourceName =
    metaContent(['meta[property="og:site_name"]']) ??
    (() => {
      try {
        return new URL(baseUrl).hostname.replace(/^www\./, "");
      } catch {
        return undefined;
      }
    })();

  const canonicalHref = $('link[rel="canonical"]').attr("href");
  const canonicalUrl = resolveUrl(canonicalHref, baseUrl) ?? baseUrl;

  const faviconHref = $('link[rel="icon"], link[rel="shortcut icon"]')
    .first()
    .attr("href");
  const faviconUrl = resolveUrl(faviconHref, baseUrl);

  const metadata: Record<string, string> = {};

  const addField = (rawLabel: string, rawValue: string) => {
    const key = normalizeKey(rawLabel);
    const value = cleanText(rawValue);
    if (!key || !value) return;
    if (key.length > 30 || value.length > 200) return; // guard against noise
    if (GENERIC_LABELS_TO_IGNORE.has(key)) return;
    if (key in metadata) return; // first source found wins
    metadata[key] = value;
  };

  // 1. JSON-LD structured data (schema.org). Highest confidence source.
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      const candidates = obj["@graph"] && Array.isArray(obj["@graph"]) ? obj["@graph"] : [obj];
      for (const candidate of candidates as Record<string, unknown>[]) {
        if (!candidate || typeof candidate !== "object") continue;
        const brand = candidate.brand;
        if (typeof brand === "string") addField("brand", brand);
        else if (brand && typeof brand === "object" && "name" in brand) {
          const name = (brand as Record<string, unknown>).name;
          if (typeof name === "string") addField("brand", name);
        }
        if (typeof candidate.category === "string") addField("category", candidate.category);
        if (typeof candidate.sku === "string") addField("sku", candidate.sku);
        if (typeof candidate.author === "string") addField("author", candidate.author);
        else if (
          candidate.author &&
          typeof candidate.author === "object" &&
          "name" in (candidate.author as Record<string, unknown>)
        ) {
          const name = (candidate.author as Record<string, unknown>).name;
          if (typeof name === "string") addField("author", name);
        }
        if (typeof candidate.datePublished === "string") {
          addField("year", candidate.datePublished.slice(0, 4));
        }
      }
    }
  });

  // 2. WooCommerce-style product attribute tables — a common pattern on
  // shop/archive sites (used generically, not specific to any one site).
  $(
    "table.shop_attributes tr, table.woocommerce-product-attributes tr, .product_meta tr"
  ).each((_, row) => {
    const label = $(row).find("th, td").first().text();
    const value = $(row).find("td").last().text();
    if (label && value && label !== value) addField(label, value);
  });

  // 3. Definition lists (dt/dd pairs).
  $("dl").each((_, dl) => {
    const terms = $(dl).find("dt");
    terms.each((_, dt) => {
      const dd = $(dt).nextAll("dd").first();
      if (dd.length) addField($(dt).text(), dd.text());
    });
  });

  // 4. Generic two-column tables (label in first cell, value in second).
  $("table tr").each((_, row) => {
    const cells = $(row).find("th, td");
    if (cells.length === 2) {
      const label = $(cells[0]).text();
      const value = $(cells[1]).text();
      if (label && value) addField(label, value);
    }
  });

  // 5. "Label: Value" text lines within likely product/detail containers.
  // Kept narrow (specific containers, short labels only) to avoid pulling
  // noise out of prose paragraphs.
  const candidateContainers = $(
    ".product-summary, .entry-summary, .summary, .product-details, .product_meta, .single-product-content"
  );
  candidateContainers.each((_, container) => {
    const text = $(container).text();
    const lines = text.split(/\n+/);
    for (const line of lines) {
      const match = line.match(/^\s*([A-Za-z][A-Za-z\s]{1,24}):\s*(.{1,100})\s*$/);
      if (match) addField(match[1], match[2]);
    }
  });

  return {
    title,
    description,
    imageUrl,
    sourceName,
    canonicalUrl,
    faviconUrl,
    metadata,
  };
}
