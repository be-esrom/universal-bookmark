"use client";

import { useBookmarks } from "@/lib/bookmark-context";

export default function CollectionShelf() {
  const { collections, addCollection, activeFilter, setActiveFilter } = useBookmarks();

  function handleAddCollection() {
    const name = window.prompt("Name your new collection");
    if (name && name.trim()) addCollection(name.trim());
  }

  function handleSelect(collection: { id: string; name: string }) {
    // "All Items" clears the filter; anything else filters by that name.
    setActiveFilter(collection.id === "all" ? null : collection.name);
  }

  return (
    <section id="collections" className="mx-auto max-w-6xl px-6 pb-14 scroll-mt-20">
      <h2 className="text-[22px] font-semibold tracking-tight text-ink mb-4">
        Collections
      </h2>

      <div className="flex flex-wrap items-stretch gap-2">
        {collections.map((c) => {
          const isActive = c.id === "all" ? activeFilter === null : activeFilter === c.name;
          return (
            <button
              key={c.id}
              onClick={() => handleSelect(c)}
              className={`flex items-center gap-2.5 rounded-tab px-4 py-2.5 text-[14px] transition-all duration-200 ease-apple ${
                isActive
                  ? "bg-solid text-solid-foreground"
                  : "bg-surface border border-line text-ink hover:border-ink/30"
              }`}
            >
              <span className="font-medium">{c.name}</span>
              <span
                className={`text-[12px] rounded-full px-2 py-0.5 ${
                  isActive
                    ? "bg-solid-foreground/20 text-solid-foreground"
                    : "bg-paper text-clay border border-line"
                }`}
              >
                {c.itemCount}
              </span>
            </button>
          );
        })}

        <button
          onClick={handleAddCollection}
          className="flex items-center gap-1.5 rounded-tab border border-dashed border-clay/50 px-4 py-2.5 text-[14px] text-clay hover:text-ink hover:border-ink/40 transition-colors duration-200 ease-apple"
        >
          <span className="text-base leading-none">+</span>
          Add Collection
        </button>
      </div>
    </section>
  );
}
