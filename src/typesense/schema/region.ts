import type { CollectionCreateSchema } from "typesense/lib/Typesense/Collections";
import { db } from "@/lib/db";

export const COLLECTION_NAME = "regions";
export const BATCH_SIZE = 100;

export const TYPESENSE_REGION_SCHEMA = (
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
      name: "names",
      type: "object[]",
    },
    {
      name: "transliteration",
      type: "string",
      optional: true,
      sort: true,
    },
    {
      name: "booksCount",
      type: "int32",
    },
    {
      name: "authorsCount",
      type: "int32",
    },
    {
      name: "_popularity",
      type: "int32",
    },
  ],
});

export interface TypesenseRegion {
  id: string;
  slug: string;

  names: { locale: string; text: string }[];
  transliteration?: string;

  booksCount: number;
  authorsCount: number;
  _popularity: number;
}

export const prepareTypesenseRegionsData = async () => {
  const regions = await db.region.findMany({
    select: {
      id: true,
      slug: true,
      transliteration: true,
      numberOfAuthors: true,
      numberOfBooks: true,
      nameTranslations: {
        select: {
          locale: true,
          text: true,
        },
      },
    },
  });

  return regions.map((region): TypesenseRegion => {

    return {
      id: region.id,
      slug: region.slug,
      names: region.nameTranslations,
      transliteration: region.transliteration ?? undefined,
      booksCount: region.numberOfBooks,
      authorsCount: region.numberOfAuthors,
      _popularity: region.numberOfBooks + region.numberOfAuthors,
    };
  });
};
