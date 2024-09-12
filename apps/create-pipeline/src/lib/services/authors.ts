import type { AuthorDocument } from "@/types";
import { db } from "@/lib/db";

import { dedupeStrings, getNamesVariations } from "@usul/utils";

export const getAuthorsData = async () => {
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
      locations: true,
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
      year: author.year,
      transliteration: author.transliteration ?? undefined,
      primaryNames: author.primaryNameTranslations,
      otherNames: author.otherNameTranslations,
      geographies: dedupeStrings(author.locations.map((l) => l.id)),
      regions: dedupeStrings(
        author.locations.map((l) => l.regionId).filter(Boolean) as string[],
      ),
      bios: author.bioTranslations,
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
