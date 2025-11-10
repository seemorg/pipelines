import type { CollectionCreateSchema } from "typesense/lib/Typesense/Collections";
import { db } from "@/lib/db";

export const COLLECTION_NAME = "advancedGenres";
export const BATCH_SIZE = 100;

export const TYPESENSE_ADVANCED_GENRE_SCHEMA = (
  indexName: string,
): CollectionCreateSchema => ({
  name: indexName,
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
      name: "nameTranslations",
      type: "object[]",
    },
    {
      name: "booksCount",
      type: "int32",
    },
    {
      name: "_popularity",
      type: "int32",
    },
  ],
});

export interface TypesenseAdvancedGenre {
  id: string;
  slug: string;
  transliteration?: string | null;
  nameTranslations: {
    text: string;
    locale: string;
  }[];
  booksCount: number;
  _popularity: number;
}

export const prepareTypesenseAdvancedGenresData = async () => {
  const genres = await db.advancedGenre.findMany({
    select: {
      id: true,
      slug: true,
      nameTranslations: true,
      transliteration: true,
      _count: {
        select: {
          books: true,
        },
      },
    },
  });

  return genres.map(
    (genre): TypesenseAdvancedGenre => ({
      id: genre.id,
      slug: genre.slug,
      transliteration: genre.transliteration,
      nameTranslations: genre.nameTranslations,
      booksCount: genre._count.books,
      _popularity: genre._count.books,
    }),
  );
};
