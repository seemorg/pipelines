import type { CollectionCreateSchema } from "typesense/lib/Typesense/Collections";
import { db } from "@/lib/db";
import { dedupeStrings, getNamesVariations } from "@/utils";

export const COLLECTION_NAME = "authors";
export const BATCH_SIZE = 100;

export const TYPESENSE_AUTHOR_SCHEMA = (
  collection: string,
): CollectionCreateSchema => ({
  name: collection,
  enable_nested_fields: true,
  fields: [
    {
      name: "id",
      type: "string",
    },
    {
      name: "slug",
      type: "string",
    },
    {
      name: "transliteration",
      type: "string",
      optional: true,
      sort: true,
    },
    {
      name: "year",
      type: "int32",
      facet: true,
      optional: true,
    },
    {
      name: "primaryNames",
      type: "object[]",
    },
    {
      name: "otherNames",
      type: "object[]",
    },
    {
      name: "otherNameTransliterations",
      type: "string[]",
    },
    {
      name: "geographies",
      type: "string[]",
      facet: true,
    },
    {
      name: "regions",
      type: "string[]",
      facet: true,
    },
    {
      name: "empires",
      type: "string[]",
      facet: true,
    },
    {
      // this is an internal field that we'll use to search for name variations
      name: "_nameVariations",
      type: "string[]",
      optional: true,
    },
    {
      name: "_popularity",
      type: "int32",
    },
    // {
    //   name: 'books',
    //   type: 'object[]',
    //   index: false, // don't index books
    //   optional: true,
    // },
    {
      name: "booksCount",
      type: "int32",
      optional: true,
    },
  ],
});

export interface AuthorDocument {
  id: string;
  slug: string;
  transliteration?: string;
  otherNameTransliterations: string[];
  year?: number;
  primaryNames: {
    locale: string;
    text: string;
  }[];
  otherNames: {
    locale: string;
    texts: string[];
  }[];
  geographies: string[];
  regions: string[];
  empires: string[];
  _nameVariations?: string[];
  _popularity: number;
  booksCount?: number;
}

export const prepareTypesenseAuthorsData = async () => {
  const authors = await db.author.findMany({
    select: {
      id: true,
      slug: true,
      year: true,
      transliteration: true,
      primaryNameTranslations: {
        select: {
          text: true,
          locale: true,
        },
      },
      bioTranslations: {
        select: {
          text: true,
          locale: true,
        },
      },
      otherNameTranslations: {
        select: {
          texts: true,
          locale: true,
        },
      },
      otherNameTransliterations: true,
      locations: true,
      empires: true,
      regions: true,
      _count: {
        select: {
          books: true,
        },
      },
    },
  });

  return authors.map((author): AuthorDocument => {
    return {
      id: author.id,
      slug: author.slug,
      year: author.year ? author.year : undefined,
      transliteration: author.transliteration ?? undefined,
      otherNameTransliterations: author.otherNameTransliterations,
      primaryNames: author.primaryNameTranslations,
      otherNames:
        author.otherNameTranslations.length === 0
          ? [{ texts: [], locale: "en" }]
          : author.otherNameTranslations,
      geographies: dedupeStrings(author.locations.map((l) => l.id)),
      regions: author.regions.map((r) => r.id),
      empires: author.empires.map((e) => e.id),
      booksCount: author._count.books,
      _popularity: author._count.books,
      _nameVariations: dedupeStrings(
        getNamesVariations([
          ...author.primaryNameTranslations.map(({ text }) => text),
          ...author.otherNameTranslations.flatMap(({ texts }) => texts),
          ...(author.transliteration ? [author.transliteration] : []),
        ]),
      ),
    };
  });
};
