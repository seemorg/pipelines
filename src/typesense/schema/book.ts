import type { CollectionCreateSchema } from "typesense/lib/Typesense/Collections";
import { db } from "@/lib/db";
import { dedupeStrings, getNamesVariations } from "@/utils";

import { prepareTypesenseAuthorsData } from "./author";

export const COLLECTION_NAME = "books";
export const BATCH_SIZE = 50;

export const TYPESENSE_BOOK_SCHEMA = (
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
    },
    {
      name: "authorId",
      type: "string",
      facet: true,
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
      name: "_nameVariations",
      type: "string[]",
    },
    {
      name: "_popularity",
      type: "int32",
    },
    {
      name: "year",
      type: "int32",
      facet: true,
      optional: true,
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
      name: "author",
      type: "object",
      optional: true,
    },
    {
      name: "versions",
      type: "object[]",
      index: false,
    },
    {
      name: "coverUrl",
      type: "string",
      optional: true,
      index: false,
    },
    {
      name: "genreIds",
      type: "string[]",
      facet: true,
    },
  ],
});

export interface TypesenseBook {
  id: string;
  slug: string;
  transliteration?: string;
  authorId: string;
  primaryNames: {
    text: string;
    locale: string;
  }[];
  otherNames: {
    texts: string[];
    locale: string;
  }[];
  _nameVariations: string[];
  _popularity: number;
  year?: number;
  geographies: string[];
  regions: string[];
  genreIds: string[];
  versions: PrismaJson.BookVersion[];
  coverUrl?: string;
  author: {
    id: string;
    slug: string;
    transliteration?: string;
    year?: number;
    primaryNames: {
      text: string;
      locale: string;
    }[];
    otherNames: {
      texts: string[];
      locale: string;
    }[];
    _nameVariations?: string[];
    booksCount?: number;
  };
}

export const prepareTypesenseBooksData = async () => {
  const authors = await prepareTypesenseAuthorsData();
  const authorsMap = new Map<string, (typeof authors)[number]>(
    authors.map((author) => [author.id, author]),
  );

  const books = await db.book.findMany({
    select: {
      id: true,
      slug: true,
      versions: true,
      transliteration: true,
      coverImageUrl: true,
      primaryNameTranslations: {
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
      authorId: true,
      genres: {
        select: {
          id: true,
        },
      },
    },
  });

  return books.map((book): TypesenseBook => {
    const author = authorsMap.get(book.authorId);
    if (!author) {
      throw new Error(`Author ${book.authorId} not found`);
    }

    return {
      id: book.id,
      slug: book.slug,
      transliteration: book.transliteration ?? undefined,
      primaryNames: book.primaryNameTranslations,
      otherNames:
        book.otherNameTranslations.length === 0
          ? [{ texts: [], locale: "en" }]
          : book.otherNameTranslations,
      genreIds: book.genres.map((genre) => genre.id),
      versions: book.versions,
      year: author.year,
      authorId: book.authorId,
      author: {
        id: author.id,
        slug: author.slug,
        transliteration: author.transliteration ?? undefined,
        year: author.year,
        primaryNames: author.primaryNames,
        otherNames: author.otherNames,
        _nameVariations: author._nameVariations,
        booksCount: author.booksCount,
      },
      geographies: author.geographies,
      regions: author.regions,
      _popularity: author._popularity,
      coverUrl: book.coverImageUrl ?? undefined,
      _nameVariations: dedupeStrings(
        getNamesVariations([
          ...book.primaryNameTranslations.map(({ text }) => text),
          ...book.otherNameTranslations.flatMap(({ texts }) => texts),
          ...(book.transliteration ? [book.transliteration] : []),
        ]),
      ),
    };
  });
};
