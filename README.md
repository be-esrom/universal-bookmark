# Universal Bookmark

Personal web collection app — save anything from the internet in one organized place.

## Step 1 of the build: Project structure + Homepage

This first pass sets up the Next.js project and builds the homepage UI with
static sample data. No backend, extraction, or AI yet — that comes next.

### What was created

```
universal-bookmark/
├── app/
│   ├── layout.tsx        # Root layout, loads fonts (Fraunces + IBM Plex Sans)
│   ├── page.tsx          # Homepage — assembles the sections below
│   └── globals.css       # Tailwind + base styles
├── components/
│   ├── Header.tsx          # Logo, nav (Home / All Items / Wishlist / Collections), search, settings, avatar
│   ├── AddBookmarkHero.tsx # Hero heading + URL input + Save button
│   ├── CollectionShelf.tsx # Collections as browsable tabs + "Add Collection"
│   ├── BookmarkCard.tsx    # Single card — renders only fields that exist
│   └── RecentlySaved.tsx   # Grid of recent bookmarks (sample data for now)
├── lib/
│   └── types.ts          # Bookmark & Collection types, flexible `metadata`
├── tailwind.config.ts     # Design tokens (colors, fonts, radii)
└── package.json
```

### How to run it

You'll need [Node.js](https://nodejs.org) 18+ installed locally.

```bash
cd universal-bookmark
npm install
npm run dev
```

Then open http://localhost:3000.

### How to test it

- The homepage should load with the hero, a row of collection tabs, and
  three sample bookmark cards (a jersey, a book, a pair of shoes).
- Type a URL into the input — the "Save Bookmark" button should enable.
- Resize the window down to mobile width — nav collapses, cards stack to
  a single column.
- Tab through the page with your keyboard — every interactive element
  should show a visible focus ring.

### What should happen

A clean, static homepage that matches the product's look and feel. Nothing
is wired to a real backend yet — the URL input doesn't do anything on submit,
and the three bookmark cards are hardcoded sample data, deliberately built
with different, incomplete metadata (the jersey has no image or price, the
book has no image, the shoes have a price) to prove the card component
degrades gracefully rather than assuming every field exists.

### Limitations (expected at this stage)

- No backend — nothing persists, "Save Bookmark" doesn't submit anywhere yet.
- No auth.
- No real bookmark detail page yet.
- No URL extraction or AI classification yet.
- Collections and bookmarks are hardcoded sample arrays.

## Step 2 of the build: Real URL → analyze → bookmark workflow

### What was created

```
app/api/bookmarks/analyze/route.ts   # POST endpoint: fetch → extract → return bookmark
lib/security/url-validation.ts       # SSRF guards: protocol + DNS-based private-IP checks
lib/extract/metadata.ts              # Generic HTML metadata + structured-field extraction
lib/bookmark-context.tsx             # Client-side bookmark state, persisted to localStorage
```

### What was modified

```
components/AddBookmarkHero.tsx   # Real submit handler: loading/success/error states
components/RecentlySaved.tsx     # Now a client component reading live bookmarks + demo items
app/page.tsx                     # Wrapped in <BookmarksProvider> so state is shared
package.json                     # Added "cheerio" dependency
```

### npm packages installed

- `cheerio` — lightweight, dependency-light server-side HTML parser (jQuery-like API, no browser/DOM engine, no JS execution from the fetched page). Added to `package.json`; run `npm install` to pull it in.

### How it works

1. You paste a URL and click **Save Bookmark**.
2. The client does a quick sanity check (is it a valid `http(s)` URL), then POSTs to `/api/bookmarks/analyze` and shows **Analyzing...**.
3. The server:
   - Validates the URL's protocol (`http`/`https` only).
   - Resolves the hostname via DNS and rejects it if it points to a private, loopback, or link-local address (blocks `localhost`, `127.0.0.1`, `10.x.x.x`, `192.168.x.x`, `169.254.169.254`, etc.) — this check runs again on every redirect hop, not just the first URL, since a redirect could otherwise be used to reach an internal address.
   - Fetches the page with an 8-second timeout and a 2MB cap on downloaded HTML, following redirects manually so each hop is re-validated.
   - Parses the HTML with `cheerio` and extracts: `og:`/`twitter:`/standard `<meta>` tags, canonical URL, favicon, and JSON-LD (schema.org) data.
   - Looks for structured fields (team, brand, season, etc.) generically — not hardcoded to any one site — by checking, in order: JSON-LD, WooCommerce-style product attribute tables (a common pattern on shop/archive sites), definition lists (`dt`/`dd`), generic two-column tables, and finally "Label: Value" text lines inside likely product/detail containers.
   - Returns a bookmark object with `category`/`subcategory` as `null` and `tags` as `[]` — nothing invented, ready for the AI classification step later.
4. The client adds the returned bookmark to shared state (persisted to `localStorage` under the key `universal-bookmark:bookmarks`) and it immediately appears at the top of **Recently Saved** — no reload.
5. Errors (unreachable page, blocked address, timeout, non-HTML response) show a plain message under the input — never a stack trace.

### How to test it

```bash
cd universal-bookmark
npm install
npm run dev
```

Then open http://localhost:3000 and paste:

```
https://basketballjerseyarchive.com/florida-gators-2023-2024-alternate-jersey-83283/
```

Expected: button shows "Analyzing...", then a new card appears at the top of Recently Saved with the title, the page's image (if `og:image` is present), source name, and whatever structured fields the extractor found (team/season/type/brand/league, if the page exposes them via meta tags, JSON-LD, or an attribute table).

Also worth testing:
- An internal address like `http://localhost:3000` or `http://127.0.0.1` — should be rejected with a clear error, not silently succeed.
- A non-existent URL — should show "Couldn't analyze this webpage."
- Refresh the page after saving a bookmark — it should still be there (localStorage).

### A limitation worth knowing about

I built and reviewed this code carefully but **could not run `npm install` or actually fetch the test URL** in this environment (no network access here), so I haven't visually confirmed the exact fields extracted from `basketballjerseyarchive.com` match what you listed. The extraction logic is generic (JSON-LD → common attribute-table patterns → definition lists → generic tables → labeled text), not hardcoded to that site, but if the real page's HTML uses a structure my selectors don't catch, some fields (season/type/league in particular) might come back missing rather than wrong — which is the safe failure mode, but let me know what you see and I'll tighten the extractor to match that site's actual markup.

## Step 3 of the build: Apple-style redesign + full interactivity

### Design tokens

- **Color:** page background `#FBFBFD`, cards white, text `#1D1D1F`, secondary
  text `#86868B`, hairline borders `#D2D2D7`, single accent `#0071E3`
  (Apple's system blue) used only for primary actions and active states.
- **Type:** the real system font stack (`-apple-system, BlinkMacSystemFont,
  "SF Pro Display"...`) — this is SF Pro itself on Apple devices, and it
  removes the app's only external network dependency (previously two Google
  Fonts). Large headlines use tight negative letter-spacing.
- **Layout:** frosted sticky header (`backdrop-blur-xl` + translucent
  background), 20px-radius cards with a hairline border instead of a heavy
  shadow, a pill-shaped segmented control for collections, pill buttons with
  Apple's tactile `active:scale` press feedback.

### Every control is now functional, not decorative

- **Nav (Home / All Items / Wishlist / Collections):** filters and/or
  smooth-scrolls to the relevant section.
- **Search:** expands into a pill input and filters live across title,
  source, category, tags, and metadata values — searches everything
  regardless of the active collection filter.
- **Collections shelf:** each pill is a real filter with a live item count;
  clicking one filters Recently Saved by that category/subcategory. **+ Add
  Collection** prompts for a name and adds it (matches bookmarks by category
  or subcategory name — a bookmark needs a matching category to show up in a
  custom collection, since there's no manual "add to collection" action yet).
- **Settings (gear icon):** a real popover with "Clear all saved bookmarks"
  (asks for confirmation first).
- **Profile avatar:** a popover explaining bookmarks are stored locally only.
- **Bookmark cards:** "View" opens the original URL in a new tab; hovering
  reveals a delete (×) button that removes the bookmark from state and
  storage immediately.
- **"View all":** clears the active filter/search and returns to the full list.

### Files changed

```
tailwind.config.ts        # Apple color/type/radius tokens
app/layout.tsx            # Removed Google Fonts, uses system font stack
app/globals.css           # Apple background/selection colors, fadeIn keyframe
lib/types.ts              # Removed the colored category-accent system
lib/bookmark-context.tsx  # Added collections, search, filter, delete, clear-all
components/Header.tsx     # Functional nav, search, settings, profile
components/CollectionShelf.tsx  # Real segmented filter control
components/BookmarkCard.tsx     # Apple styling + View Original + delete
components/RecentlySaved.tsx    # Filters by search/collection, empty state
```

No new npm packages were needed for this pass — removing the Google Fonts
call actually means one less thing to fetch at build time.

### How to test it

```bash
cd universal-bookmark
npm install
npm run dev
```

- Type in the search bar — the grid should filter live across all fields.
- Click a collection pill — the grid filters, the pill goes dark, and the
  section heading changes to that collection's name.
- Click **+ Add Collection**, name it something that matches an existing
  bookmark's category (e.g. "Books") to see it populate immediately.
- Hover a card and click the **×** — it should disappear and stay gone after
  a refresh (removed from `localStorage`).
- Click **View** on a card — the original URL opens in a new tab.
- Click the gear icon → **Clear all saved bookmarks** — confirms, then empties
  the grid.
- Click the avatar (top right) — see the local-only account note.

## Step 4 of the build: Dark mode + design polish

### Dark mode

Implemented as three modes — **Light / Dark / Auto** — matching macOS's own
Appearance setting exactly. Find it under the gear icon in the header.

Architecturally, colors are CSS variables (`app/globals.css`), and every
component uses the same semantic Tailwind classes (`bg-paper`, `text-ink`,
`bg-surface`, etc.) in both themes — only the variable values change under a
`.dark` class on `<html>`. This is deliberately **not** a literal color
inversion: dark surfaces get their own values (`#1c1c1e` card surfaces on a
pure black page, a slightly brighter accent blue for contrast), the way
Apple's own dark mode actually works.

- No flash of the wrong theme on load — an inline script in
  `app/layout.tsx` applies the right class before React hydrates, reading a
  stored preference or falling back to the OS setting.
- "Auto" listens for OS-level theme changes live (e.g. macOS's scheduled
  Night Shift-style switch) without a page reload.
- Preference is stored in `localStorage` under `universal-bookmark:theme`.

**One real bug fixed along the way:** the active collection pill and the
profile avatar were using `bg-ink` (a color that means "primary text," and
therefore flips to near-white in dark mode) as a filled background with
white text on top — in dark mode that would have rendered as white text on
a near-white pill, invisible. Introduced dedicated `solid` /
`solid-foreground` tokens for these "inverted fill" chips, which stay
high-contrast in both themes independent of what `ink` means.

### Other polish

- Brand mark icon added next to the wordmark in the header.
- Hero headline scaled up (52px → 80px across breakpoints) with tighter
  letter-spacing, closer to Apple's actual hero type scale.
- Replaced a few remaining hardcoded `bg-white`/`bg-black` fills (search
  field hover state, card backgrounds) with theme-aware tokens that adapt
  correctly instead of staying stuck in light-mode colors.
- `color-scheme: light dark` set on `<html>`, so native form controls and
  scrollbars also follow the theme, not just the app's own UI.

### Files changed

```
app/globals.css          # CSS variable tokens for both themes
tailwind.config.ts        # darkMode: "class", colors wired to variables, solid/surface tokens
app/layout.tsx             # No-flash theme script, wraps app in ThemeProvider
lib/theme-context.tsx      # New: Light/Dark/Auto state, persistence, OS-change listener
components/Header.tsx      # Appearance control, brand mark, fixed ink/white contrast bug
components/CollectionShelf.tsx  # Fixed same contrast bug on the active pill
components/BookmarkCard.tsx     # bg-white → bg-surface
components/AddBookmarkHero.tsx  # bg-white → bg-surface, larger hero type
```

### How to test it

```bash
cd universal-bookmark
npm install
npm run dev
```

- Gear icon → Appearance → click **Dark**. The whole page should switch
  immediately, including popovers, the search field, and card surfaces —
  nothing should stay stuck in light colors.
- Click **Auto**, then change your OS appearance (System Settings on macOS,
  or your browser dev tools' "Emulate CSS prefers-color-scheme") — the app
  should follow without a reload.
- Refresh the page after picking Dark — it should stay dark (no flash of
  white before it switches).
- In dark mode, check the active collection pill and the avatar circle
  specifically — text should stay clearly readable, not washed out.

### A note on scope

"Add Collection" still uses a plain `window.prompt()` rather than a custom
modal — functional, but not a polished Apple-style dialog. Worth replacing
with a proper modal component in a later pass if you want full visual
consistency there.



