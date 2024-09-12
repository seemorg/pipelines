import type { GenreDocument } from "@/types";
import { db } from "@/lib/db";

export const getGenresData = async () => {
  const genres = await db.genre.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      _count: {
        select: {
          books: true,
        },
      },
    },
  });

  return genres.map(
    (genre): GenreDocument => ({
      id: genre.id,
      slug: genre.slug,
      name: genre.name,
      booksCount: genre._count.books,
      _popularity: genre._count.books,
    }),
  );
};
