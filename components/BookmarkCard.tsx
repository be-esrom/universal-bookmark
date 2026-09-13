"use client";

import Image from "next/image";
import type { Bookmark } from "@/lib/types";

export default function BookmarkCard({
  bookmark,
  onDelete,
}: {
  bookmark: Bookmark;
  /** Omit for read-only/demo cards — the delete control won't render. */
  onDelete?: () => void;
}) {
  // Pull at most two metadata entries to keep the card compact; a future
  // detail page can show everything. Never fabricate a value if empty.
  const metaEntries = Object.entries(bookmark.metadata)
    .filter(([, v]) => v !== undefined && v !== "")
    .slice(0, 2);

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (onDelete) onDelete();
  }

  return (
    <article className="group relative rounded-card border border-line/70 bg-surface overflow-hidden transition-all duration-300 ease-apple hover:shadow-card-hover hover:-translate-y-0.5">
      {onDelete && (
        <button
          onClick={handleDelete}
          aria-label={`Remove ${bookmark.title}`}
          className="absolute right-2.5 top-2.5 z-10 h-7 w-7 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-black/60"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}

      <div className="relative aspect-[4/3] bg-paper">
        {bookmark.imageUrl ? (
          <Image
            src={bookmark.imageUrl}
            alt={bookmark.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-clay/50 text-sm">
            No image
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col gap-1.5">
        <h3 className="text-[15px] font-semibold leading-snug text-ink tracking-tight">
          {bookmark.title}
        </h3>

        {(bookmark.category || bookmark.subcategory) && (
          <p className="text-[13px] text-clay">
            {[bookmark.category, bookmark.subcategory].filter(Boolean).join(" · ")}
          </p>
        )}

        {metaEntries.length > 0 && (
          <div className="text-[13px] text-ink/70 space-y-0.5">
            {metaEntries.map(([key, value]) => (
              <div key={key}>{value}</div>
            ))}
          </div>
        )}

        <div className="mt-2 pt-2.5 border-t border-line/60 flex items-center justify-between">
          <span className="text-[12px] text-clay truncate">
            {bookmark.sourceName ?? safeHostname(bookmark.originalUrl)}
          </span>

          <div className="flex items-center gap-3 shrink-0">
            {typeof bookmark.metadata.price !== "undefined" && (
              <span className="text-[13px] font-medium text-ink">
                {bookmark.metadata.currency ?? "$"}
                {bookmark.metadata.price}
              </span>
            )}
            <a
              href={bookmark.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[13px] font-medium text-accent hover:text-accent-dark transition-colors"
            >
              View
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
