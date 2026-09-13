/**
 * Core data model. `metadata` is intentionally an open bag of fields —
 * different bookmark types (jersey, book, product, restaurant, ...) populate
 * whichever keys are relevant to them. Never assume a field exists.
 */
export interface Bookmark {
  id: string;
  userId: string;
  originalUrl: string;
  title: string;
  description?: string;
  imageUrl?: string;
  sourceName?: string;
  category?: string;
  subcategory?: string;
  tags: string[];
  metadata: Record<string, string | number | undefined>;
  createdAt: string;
  updatedAt: string;
}

export interface Collection {
  id: string;
  name: string;
  itemCount: number;
}
