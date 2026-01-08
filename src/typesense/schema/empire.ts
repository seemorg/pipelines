import type { CollectionCreateSchema } from "typesense/lib/Typesense/Collections";
import { db } from "@/lib/db";

export const COLLECTION_NAME = "empires";
export const BATCH_SIZE = 100;

export const TYPESENSE_EMPIRE_SCHEMA = (
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
      name: "booksCount",
      type: "int32",
    },
    {
      name: "authorsCount",
      type: "int32",
    },
    {
      name: "transliteration",
      type: "string",
      optional: true,
      sort: true,
    },
    {
      name: "hijriStartYear",
      type: "int32",
      optional: true,
      sort: true,
    },
    {
      name: "hijriEndYear",
      type: "int32",
      optional: true,
      sort: true,
    },
    {
      name: "_popularity",
      type: "int32",
    },
  ],
});

export interface TypesenseEmpire {
  id: string;
  slug: string;
  names: { locale: string; text: string }[];
  transliteration?: string;
  hijriStartYear?: number;
  hijriEndYear?: number;
  booksCount: number;
  authorsCount: number;
  _popularity: number;
}

export const prepareTypesenseEmpiresData = async () => {
  const empires = await db.empire.findMany({
    select: {
      id: true,
      slug: true,
      numberOfAuthors: true,
      numberOfBooks: true,
      transliteration: true,
      hijriStartYear: true,
      hijriEndYear: true,
      nameTranslations: {
        select: {
          locale: true,
          text: true,
        },
      },
    },
  });

  return empires.map((empire): TypesenseEmpire => {
    return {
      id: empire.id,
      slug: empire.slug,
      names: empire.nameTranslations,
      transliteration: empire.transliteration ?? undefined,
      hijriStartYear: empire.hijriStartYear ?? 0,
      hijriEndYear: empire.hijriEndYear ?? 0,
      booksCount: empire.numberOfBooks,
      authorsCount: empire.numberOfAuthors,

      _popularity: empire.numberOfBooks + empire.numberOfAuthors,
    };
  });
};
