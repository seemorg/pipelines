import type { RegionDocument } from "@/types";
import { db } from "@/lib/db";

export const getRegionsData = async () => {
  const regions = await db.region.findMany({
    select: {
      id: true,
      slug: true,
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

  return regions.map((region): RegionDocument => {
    const subLocations = region.locations.flatMap(
      (l) => l.cityNameTranslations,
    );

    // remove duplicates
    const uniqueSubLocations = subLocations.filter(
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
      currentNames: region.currentNameTranslations,
      booksCount: region.numberOfBooks,
      authorsCount: region.numberOfAuthors,
      _popularity: region.numberOfBooks + region.numberOfAuthors,
      subLocations: uniqueSubLocations,
      subLocationsCount: uniqueSubLocations.length,
    };
  });
};
