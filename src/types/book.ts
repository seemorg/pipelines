import type { LocalizedArrayEntry, LocalizedEntry } from "./LocalizedEntry";

export type BookDocument = {
  id: string;
  slug: string;
  authorId: string;
  transliteration?: string;

  primaryNames: LocalizedEntry[];
  otherNames: LocalizedArrayEntry[];

  _nameVariations: string[];
  _popularity: number;
  versions: PrismaJson.BookVersion[];
  genreIds: string[];

  // these are derived from the author
  author: {
    id: string;
    slug: string;
    transliteration?: string;
    year: number | null;
    primaryNames: LocalizedEntry[];
    otherNames: LocalizedArrayEntry[];
    _nameVariations: string[];
    booksCount: number;
  };
  year: number | null;
  geographies: string[];
  regions: string[];
};
