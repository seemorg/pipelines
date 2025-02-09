import type { LocalizedArrayEntry, LocalizedEntry } from "./LocalizedEntry";

export type AuthorDocument = {
  id: string;
  slug: string;
  year: number | null;
  transliteration?: string;

  primaryNames: LocalizedEntry[];
  otherNames: LocalizedArrayEntry[];
  bios: LocalizedEntry[];

  _nameVariations: string[];
  _popularity: number;
  geographies: string[];
  regions: string[]; // region slugs

  booksCount: number;
};
