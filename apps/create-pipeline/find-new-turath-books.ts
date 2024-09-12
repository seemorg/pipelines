import fs from "fs";
import path from "path";
import { db } from "@/lib/db";

import { getTurathBooks } from "@usul/utils";

import conflicts from "./conflicts.json";

const turathBooks = await getTurathBooks();
const turathIdsInDb = new Set<string>(
  (
    await db.book.findMany({
      select: {
        versions: true,
      },
    })
  ).flatMap((book) =>
    book.versions
      .filter((version) => version.source === "turath")
      .map((b) => b.value),
  ),
);

// get turath books that are not in the db
const newTurathBooks = turathBooks.filter(
  (book) =>
    !turathIdsInDb.has(book.id.toString()) &&
    !conflicts.includes(book.id.toString()),
);

fs.writeFileSync(
  path.join("new-turath-books.json"),
  JSON.stringify(newTurathBooks, null, 2),
);
