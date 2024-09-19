import { db } from "@/lib/db";

let books:
  | {
      id: string;
      slug: string;
      versions: PrismaJson.BookVersion[];
      flags: PrismaJson.BookFlags;
    }[]
  | undefined;
export const getBooksData = async () => {
  if (books) return books;

  books = await db.book.findMany({
    select: {
      id: true,
      slug: true,
      versions: true,
      flags: true,
    },
  });

  return books;
};
