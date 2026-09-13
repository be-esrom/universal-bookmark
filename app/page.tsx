import Header from "@/components/Header";
import AddBookmarkHero from "@/components/AddBookmarkHero";
import CollectionShelf from "@/components/CollectionShelf";
import RecentlySaved from "@/components/RecentlySaved";
import { BookmarksProvider } from "@/lib/bookmark-context";

export default function HomePage() {
  return (
    <BookmarksProvider>
      <main className="min-h-screen bg-paper">
        <Header />
        <AddBookmarkHero />
        <CollectionShelf />
        <RecentlySaved />
      </main>
    </BookmarksProvider>
  );
}
