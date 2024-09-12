import { db } from "@/lib/db";

export const getBooksData = async () => {
  const books = await db.book.findMany({
    select: {
      id: true,
      slug: true,
      versions: true,
      flags: true,
    },
  });

  return books;
};
