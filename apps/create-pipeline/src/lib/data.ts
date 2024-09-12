import { authorsQueue } from "@/author-queue";

import {
  getTurathAuthors,
  getTurathBooks,
  TurathAllDataResponse,
} from "@usul/utils";

import { db } from "./db";
import { listAllObjects } from "./r2";

let turathBooksById:
  | Record<number, TurathAllDataResponse["books"][number]>
  | undefined;

export const getTurathBooksById = async () => {
  if (turathBooksById) {
    return turathBooksById;
  }

  turathBooksById = (await getTurathBooks()).reduce(
    (acc, book) => {
      acc[book.id] = book;
      return acc;
    },
    {} as Record<number, TurathAllDataResponse["books"][number]>,
  );

  return turathBooksById;
};

let turathAuthorsById:
  | Record<number, TurathAllDataResponse["authors"][number]>
  | undefined;

export const getTurathAuthorsById = async () => {
  if (turathAuthorsById) {
    return turathAuthorsById;
  }

  turathAuthorsById = (await getTurathAuthors()).reduce(
    (acc, author) => {
      acc[author.id] = author;
      return acc;
    },
    {} as Record<number, TurathAllDataResponse["authors"][number]>,
  );

  return turathAuthorsById;
};

let slugs: Set<string> | undefined;
export const getBookSlugs = async () => {
  if (slugs) {
    return slugs;
  }

  slugs = new Set<string>(
    (await db.book.findMany({ select: { slug: true } })).map(
      (book) => book.slug,
    ),
  );

  return slugs;
};

let _authors: { id: string; slug: string }[] | undefined;

const _getAuthors = async () => {
  if (_authors) {
    return _authors;
  }

  _authors = await db.author.findMany({ select: { id: true, slug: true } });
  return _authors;
};

let authorSlugs: Set<string> | undefined;
export const getAuthorSlugs = async () => {
  if (authorSlugs) {
    return authorSlugs;
  }

  authorSlugs = new Set<string>(
    (await _getAuthors()).map((author) => author.slug),
  );
  return authorSlugs;
};

let existingTurathAuthorIds: Set<string> | undefined;
export const getExistingTurathAuthorIds = async () => {
  if (existingTurathAuthorIds) {
    return existingTurathAuthorIds;
  }

  const authors = await _getAuthors();
  existingTurathAuthorIds = new Set<string>(
    (await authorsQueue.getCompleted())
      .map((job) => job.data.turathId.toString())
      .concat(
        authors
          .filter((a) => a.id.startsWith("turath:"))
          .map((author) => author.id.split(":")[1]!),
      ),
  );

  return existingTurathAuthorIds;
};

let r2Objects: Set<string> | undefined;
let r2PatternObjects: Set<string> | undefined;

export const getR2Objects = async () => {
  if (r2Objects) {
    return r2Objects;
  }
  r2Objects = new Set<string>(
    (await listAllObjects("covers/")).map((o) => o.Key ?? ""),
  );

  return r2Objects;
};

export const getR2PatternObjects = async () => {
  if (r2PatternObjects) {
    return r2PatternObjects;
  }
  r2PatternObjects = new Set<string>(
    (await listAllObjects("patterns/")).map((o) => o.Key ?? ""),
  );

  return r2PatternObjects;
};
