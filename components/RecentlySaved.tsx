"use client";

import BookmarkCard from "./BookmarkCard";
import { useBookmarks, bookmarkMatchesCollection } from "@/lib/bookmark-context";
import type { Bookmark } from "@/lib/types";

function matchesSearch(bookmark: Bookmark, query: string): boolean {
  const q = query.toLowerCase();
  const haystack = [
    bookmark.title,
    bookmark.sourceName ?? "",
    bookmark.category ?? "",
    bookmark.subcategory ?? "",
    ...bookmark.tags,
    ...Object.values(bookmark.metadata).map((v) => String(v ?? "")),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export default function RecentlySaved() {
  const { bookmarks, removeBookmark, activeFilter, setActiveFilter, searchQuery, setSearchQuery } =
    useBookmarks();

  const query = searchQuery.trim();

  // A search query searches everything, regardless of the active collection
  // filter — narrowing to one collection first and then having to clear it
  // just to search elsewhere would be a frustrating dead end.
  const visible = query
    ? bookmarks.filter((b) => matchesSearch(b, query))
    : activeFilter
    ? bookmarks.filter((b) => bookmarkMatchesCollection(b, activeFilter))
    : bookmarks;

  const heading = query ? `Results for "${searchQuery}"` : activeFilter ?? "Recently Saved";

  function handleViewAll() {
    setActiveFilter(null);
    setSearchQuery("");
  }

  return (
    <section id="recently-saved" className="mx-auto max-w-6xl px-6 pb-24 scroll-mt-20">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-[22px] font-semibold tracking-tight text-ink">{heading}</h2>
        {(activeFilter || query) && (
          <button
            onClick={handleViewAll}
            className="text-[14px] text-accent hover:text-accent-dark transition-colors"
          >
            View all
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-card border border-dashed border-line py-16 text-center text-clay text-[14px]">
          Nothing here yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {visible.map((bookmark) => (
            <BookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              onDelete={() => removeBookmark(bookmark.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
