import type { BookDocument } from "@/types";
import { db } from "@/lib/db";

import { dedupeStrings, getNamesVariations } from "@usul/utils";

import { getAuthorsData } from "./authors";

export const getBooksData = async () => {
  const authors = await getAuthorsData();
  const authorsMap = new Map<string, (typeof authors)[number]>(
    authors.map((author) => [author.id, author]),
  );

  const books = await db.book.findMany({
    select: {
      id: true,
      slug: true,
      versions: true,
      transliteration: true,
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

  return books.map((book): BookDocument => {
    const author = authorsMap.get(book.authorId);
    if (!author) {
      throw new Error(`Author ${book.authorId} not found`);
    }

    return {
      id: book.id,
      slug: book.slug,
      transliteration: book.transliteration ?? undefined,
      primaryNames: book.primaryNameTranslations,
      otherNames: book.otherNameTranslations,
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
