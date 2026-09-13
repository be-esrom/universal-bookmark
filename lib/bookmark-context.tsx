"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Bookmark, Collection } from "@/lib/types";

const BOOKMARKS_KEY = "universal-bookmark:bookmarks";
const COLLECTIONS_KEY = "universal-bookmark:collections";

const DEFAULT_COLLECTION_NAMES = ["Wishlist", "Sports", "Books", "Home"];

// Seed content so the app isn't empty on first load. These are ordinary
// bookmarks, not special-cased — deleting them works exactly like deleting
// anything the user saves themselves.
const SEED_BOOKMARKS: Bookmark[] = [
  {
    id: "seed-1",
    userId: "local",
    originalUrl: "https://jerseyarchive.example.com/eagles-1995-home",
    title: "Philadelphia Eagles 1995 Home Jersey",
    category: "Sports",
    subcategory: "Jerseys",
    tags: ["Philadelphia Eagles", "NFL", "1995", "Vintage"],
    metadata: { team: "Philadelphia Eagles", year: "1995" },
    sourceName: "Jersey Archive",
    imageUrl: undefined,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  },
  {
    id: "seed-2",
    userId: "local",
    originalUrl: "https://openlibrary.example.com/great-gatsby",
    title: "The Great Gatsby",
    category: "Books",
    subcategory: "Classics",
    tags: ["Fiction", "Classic"],
    metadata: { author: "F. Scott Fitzgerald" },
    sourceName: "Open Library",
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
  },
  {
    id: "seed-3",
    userId: "local",
    originalUrl: "https://nike.example.com/air-force-1",
    title: "Nike Air Force 1",
    category: "Shoes",
    subcategory: "Wishlist",
    tags: ["Nike", "Sneakers"],
    metadata: { brand: "Nike", price: 120, currency: "$" },
    sourceName: "Nike",
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
  },
];

/** Shared rule for whether a bookmark belongs to a given named collection,
 * used both for filtering and for each collection's item count. */
export function bookmarkMatchesCollection(bookmark: Bookmark, collectionName: string): boolean {
  const name = collectionName.toLowerCase();
  if (name === "all items") return true;
  const category = bookmark.category?.toLowerCase();
  const subcategory = bookmark.subcategory?.toLowerCase();
  return category === name || subcategory === name;
}

interface BookmarksContextValue {
  bookmarks: Bookmark[];
  addBookmark: (bookmark: Bookmark) => void;
  removeBookmark: (id: string) => void;
  clearAllBookmarks: () => void;

  collections: Collection[];
  addCollection: (name: string) => void;

  activeFilter: string | null; // null = no filter, show everything
  setActiveFilter: (filter: string | null) => void;

  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const BookmarksContext = createContext<BookmarksContextValue | null>(null);

export function BookmarksProvider({ children }: { children: ReactNode }) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(SEED_BOOKMARKS);
  const [collectionNames, setCollectionNames] = useState<string[]>(DEFAULT_COLLECTION_NAMES);
  const [hydrated, setHydrated] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    try {
      const storedBookmarks = window.localStorage.getItem(BOOKMARKS_KEY);
      if (storedBookmarks) setBookmarks(JSON.parse(storedBookmarks) as Bookmark[]);

      const storedCollections = window.localStorage.getItem(COLLECTIONS_KEY);
      if (storedCollections) setCollectionNames(JSON.parse(storedCollections) as string[]);
    } catch {
      // Corrupt or inaccessible storage — fall back to the in-memory seed
      // data rather than crashing the homepage.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
    } catch {
      // Storage may be unavailable — app still works in-memory for the session.
    }
  }, [bookmarks, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collectionNames));
    } catch {
      // Same as above.
    }
  }, [collectionNames, hydrated]);

  function addBookmark(bookmark: Bookmark) {
    setBookmarks((prev) => [bookmark, ...prev]);
  }

  function removeBookmark(id: string) {
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  }

  function clearAllBookmarks() {
    setBookmarks([]);
  }

  function addCollection(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCollectionNames((prev) => {
      const exists = prev.some((n) => n.toLowerCase() === trimmed.toLowerCase());
      return exists ? prev : [...prev, trimmed];
    });
  }

  const collections: Collection[] = useMemo(
    () => [
      {
        id: "all",
        name: "All Items",
        itemCount: bookmarks.length,
      },
      ...collectionNames.map((name) => ({
        id: name.toLowerCase().replace(/\s+/g, "-"),
        name,
        itemCount: bookmarks.filter((b) => bookmarkMatchesCollection(b, name)).length,
      })),
    ],
    [bookmarks, collectionNames]
  );

  return (
    <BookmarksContext.Provider
      value={{
        bookmarks,
        addBookmark,
        removeBookmark,
        clearAllBookmarks,
        collections,
        addCollection,
        activeFilter,
        setActiveFilter,
        searchQuery,
        setSearchQuery,
      }}
    >
      {children}
    </BookmarksContext.Provider>
  );
}

export function useBookmarks(): BookmarksContextValue {
  const ctx = useContext(BookmarksContext);
  if (!ctx) {
    throw new Error("useBookmarks must be used within a BookmarksProvider");
  }
  return ctx;
}
