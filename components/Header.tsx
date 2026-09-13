"use client";

import { useEffect, useRef, useState } from "react";
import { useBookmarks } from "@/lib/bookmark-context";
import { useTheme, type ThemePreference } from "@/lib/theme-context";

type NavItem = "Home" | "All Items" | "Wishlist" | "Collections";
const NAV_ITEMS: NavItem[] = ["Home", "All Items", "Wishlist", "Collections"];

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Header() {
  const { setActiveFilter, activeFilter, searchQuery, setSearchQuery, clearAllBookmarks } =
    useBookmarks();
  const { preference, setPreference } = useTheme();

  const [navHighlight, setNavHighlight] = useState<NavItem>("Home");
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close the settings/profile panels on outside click.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleNavClick(item: NavItem) {
    setNavHighlight(item);
    if (item === "Home") {
      setActiveFilter(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (item === "All Items") {
      setActiveFilter(null);
      scrollToId("recently-saved");
    } else if (item === "Wishlist") {
      setActiveFilter("Wishlist");
      scrollToId("recently-saved");
    } else if (item === "Collections") {
      scrollToId("collections");
    }
  }

  // Keep the header highlight sensible if a collection tab elsewhere changed
  // the filter directly (e.g. clicking "Books" in the collections shelf).
  useEffect(() => {
    if (activeFilter === "Wishlist") setNavHighlight("Wishlist");
    else if (activeFilter === null && navHighlight === "Wishlist") setNavHighlight("Home");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter]);

  function handleClearAll() {
    if (window.confirm("Remove all saved bookmarks? This can't be undone.")) {
      clearAllBookmarks();
    }
    setSettingsOpen(false);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-accent shrink-0">
              <path
                d="M6 3.5C6 2.67 6.67 2 7.5 2h9c.83 0 1.5.67 1.5 1.5V21l-6-3.6-6 3.6V3.5Z"
                fill="currentColor"
              />
            </svg>
            <span className="text-[17px] font-semibold tracking-tight text-ink">
              Universal Bookmark
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-7 text-[13px]">
            {NAV_ITEMS.map((item) => (
              <button
                key={item}
                onClick={() => handleNavClick(item)}
                className={`transition-colors duration-200 ease-apple ${
                  navHighlight === item
                    ? "text-ink font-medium"
                    : "text-clay hover:text-ink"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1">
          {/* Search: expands into a pill input, filters bookmarks live */}
          <div className="flex items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your collection"
              aria-label="Search your collection"
              className={`transition-all duration-300 ease-apple bg-ink/[0.05] text-sm text-ink placeholder:text-clay rounded-tab outline-none focus:ring-1 focus:ring-accent ${
                searchOpen ? "w-56 px-3.5 py-1.5 opacity-100 mr-1" : "w-0 px-0 py-1.5 opacity-0"
              }`}
            />
            <button
              aria-label="Toggle search"
              onClick={() => setSearchOpen((v) => !v)}
              className="p-2 rounded-full text-clay hover:text-ink hover:bg-ink/[0.05] transition-colors"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          </div>

          <div className="relative" ref={settingsRef}>
            <button
              aria-label="Settings"
              onClick={() => setSettingsOpen((v) => !v)}
              className="p-2 rounded-full text-clay hover:text-ink hover:bg-ink/[0.05] transition-colors"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>

            {settingsOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-surface shadow-panel border border-line/70 p-3.5 animate-[fadeIn_0.15s_ease-out]">
                <p className="px-0.5 text-[13px] font-medium text-clay">Appearance</p>
                <div className="mt-2 flex items-center gap-1 rounded-control bg-paper p-1 border border-line/70">
                  {(
                    [
                      { value: "light", label: "Light" },
                      { value: "dark", label: "Dark" },
                      { value: "system", label: "Auto" },
                    ] as { value: ThemePreference; label: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPreference(opt.value)}
                      className={`flex-1 rounded-[0.5rem] py-1.5 text-[13px] font-medium transition-colors duration-150 ease-apple ${
                        preference === opt.value
                          ? "bg-solid text-solid-foreground"
                          : "text-clay hover:text-ink"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="my-3 border-t border-line/70" />

                <button
                  onClick={handleClearAll}
                  className="w-full text-left px-3 py-2 rounded-xl text-[13px] text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  Clear all saved bookmarks
                </button>
              </div>
            )}
          </div>

          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((v) => !v)}
              aria-label="Account"
              className="h-8 w-8 rounded-full bg-solid text-solid-foreground flex items-center justify-center text-xs font-medium ml-1 transition-transform duration-150 ease-apple active:scale-90"
            >
              U
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-surface shadow-panel border border-line/70 p-3.5 animate-[fadeIn_0.15s_ease-out]">
                <p className="text-[13px] font-medium text-ink">Local account</p>
                <p className="mt-1 text-[13px] text-clay leading-relaxed">
                  Your bookmarks are saved to this browser only — nothing is sent
                  to a server or shared account yet.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
