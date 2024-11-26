import { db } from "@/lib/db";
import { CollectionCreateSchema } from "typesense/lib/Typesense/Collections";

export const COLLECTION_NAME = "regions";
export const BATCH_SIZE = 50;

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
      name: "currentNames",
      type: "object[]",
    },
    {
      name: "transliteration",
      type: "string",
      optional: true,
    },

    {
      name: "subLocations",
      type: "object[]",
      optional: true,
    },
    {
      name: "subLocationsCount",
      type: "int32",
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
  currentNames: { locale: string; text: string }[];
  transliteration?: string;

  subLocations?: { locale: string; text: string }[];
  subLocationsCount: number;

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
      currentNameTranslations: {
        select: {
          locale: true,
          text: true,
        },
      },
      nameTranslations: {
        select: {
          locale: true,
          text: true,
        },
      },
      locations: {
        select: {
          cityNameTranslations: {
            select: {
              locale: true,
              text: true,
            },
          },
        },
      },
    },
  });

  return regions.map((region): TypesenseRegion => {
    const subLocations = region.locations.flatMap(
      (l) => l.cityNameTranslations,
    );

    // remove duplicates
    const uniqueSubLocations = (subLocations ?? []).filter(
      (value, index, self) =>
        index ===
        self.findIndex(
          (t) => t.locale === value.locale && t.text === value.text,
        ),
    );

    return {
      id: region.slug,
      slug: region.slug,
      names: region.nameTranslations,
      transliteration: region.transliteration ?? undefined,
      currentNames: region.currentNameTranslations,
      booksCount: region.numberOfBooks,
      authorsCount: region.numberOfAuthors,
      _popularity: region.numberOfBooks + region.numberOfAuthors,
      subLocations: uniqueSubLocations,
      subLocationsCount: uniqueSubLocations.length,
    };
  });
};
