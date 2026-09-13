"use client";

import { useState, type FormEvent } from "react";
import { useBookmarks } from "@/lib/bookmark-context";
import type { Bookmark } from "@/lib/types";

type Status = "idle" | "loading" | "success" | "error";

export default function AddBookmarkHero() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { addBookmark } = useBookmarks();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        setStatus("error");
        setErrorMessage("Only http and https URLs are supported.");
        return;
      }
    } catch {
      setStatus("error");
      setErrorMessage("That doesn't look like a valid URL.");
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/bookmarks/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMessage(data?.error ?? "Couldn't analyze this webpage.");
        return;
      }

      const bookmark: Bookmark = {
        ...data.bookmark,
        userId: "local",
        category: data.bookmark.category ?? undefined,
        subcategory: data.bookmark.subcategory ?? undefined,
        tags: data.bookmark.tags ?? [],
        metadata: data.bookmark.metadata ?? {},
      };

      addBookmark(bookmark);
      setUrl("");
      setStatus("success");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
      setErrorMessage("Couldn't analyze this webpage.");
    }
  }

  const buttonLabel =
    status === "loading" ? "Analyzing…" : status === "success" ? "Saved" : "Save";

  return (
    <section className="mx-auto max-w-3xl px-6 pt-24 pb-20 text-center">
      <h1 className="text-[52px] sm:text-[68px] lg:text-[80px] font-semibold leading-[1.04] tracking-[-0.02em] text-ink">
        Save anything
        <br />
        from the web.
      </h1>
      <p className="mt-5 text-xl text-clay">
        Your personal collection for everything you find online.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-10 mx-auto flex max-w-xl items-center gap-2 rounded-tab bg-surface border border-line/80 shadow-card p-1.5 focus-within:shadow-card-hover transition-shadow duration-300 ease-apple"
      >
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a URL here…"
          disabled={status === "loading"}
          className="flex-1 bg-transparent px-4 py-2.5 text-[15px] text-ink placeholder:text-clay outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!url.trim() || status === "loading"}
          className="rounded-tab bg-accent px-6 py-2.5 text-[15px] font-medium text-white hover:bg-accent/90 disabled:opacity-30 disabled:hover:bg-accent transition-colors duration-200 ease-apple whitespace-nowrap"
        >
          {buttonLabel}
        </button>
      </form>

      {status === "error" && errorMessage ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      ) : (
        <p className="mt-3 text-sm text-clay">
          Products, articles, jerseys, books, games, places, and more.
        </p>
      )}
    </section>
  );
}
