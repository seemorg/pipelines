import type { KeywordIndexerQueueData } from "@/queues/keyword-indexer/queue";
import type { SandboxedJob } from "bullmq";
import { fetchBookContent } from "@/book-fetchers";
import { preparePages } from "@/indexer/v1/metadata";
import { keywordSearchClient } from "@/lib/azure/keyword-search.index";
import { db } from "@/lib/db";
import { chunk } from "@/utils";

const makeId = (
  bookId: string,
  versionSource: string,
  versionId: string,
  index: number,
) =>
  Buffer.from(`${bookId}:${versionSource}:${versionId}:${index}`).toString(
    "base64url",
  );

const updateBookFlags = async (id: string, versionId: string) => {
  const book = await db.book.findUnique({
    where: { id },
    select: { id: true, versions: true },
  });

  if (!book) {
    throw new Error(`Book not found: ${id}`);
  }

  const newVersions = structuredClone(book.versions);
  for (const version of newVersions) {
    if (version.value === versionId) {
      version.keywordSupported = true;
    }
  }

  // update book flags
  await db.book.update({
    where: {
      id: book.id,
    },
    data: {
      versions: newVersions,
    },
  });
};

export default async function keywordIndexerWorker(
  job: SandboxedJob<KeywordIndexerQueueData>,
) {
  const { id, versionId } = job.data;

  const book = await db.book.findUnique({
    where: { id },
    select: { id: true, versions: true, author: { select: { id: true } } },
  });

  if (!book) {
    throw new Error(`Book not found: ${id}`);
  }

  const versionToIndex = book.versions.find((v) => v.value === versionId);
  if (!versionToIndex) {
    throw new Error(`Version not found: ${versionId}`);
  }

  const bookContent = await fetchBookContent(
    {
      id: book.id,
      author: { id: book.author.id },
      versions: book.versions,
    },
    versionToIndex.value,
  );
  if (!bookContent || bookContent.source === "external") {
    throw new Error(`Book content not found: ${id}`);
  }

  let preparedPages: ReturnType<typeof preparePages>;
  if (bookContent.source === "turath") {
    preparedPages = preparePages(
      bookContent.turathResponse.pages,
      bookContent.turathResponse.headings,
      {
        preprocessUsingSplitter: false,
        shouldRemoveDiacritics: false,
      },
    );
  } else if (bookContent.source === "openiti") {
    preparedPages = preparePages(bookContent.content, bookContent.chapters, {
      preprocessUsingSplitter: false,
      shouldRemoveDiacritics: false,
    });
  } else {
    preparedPages = preparePages(bookContent.pages, bookContent.headings, {
      preprocessUsingSplitter: false,
      shouldRemoveDiacritics: false,
    });
  }

  const batches = chunk(preparedPages, 100);
  for (const batch of batches) {
    await keywordSearchClient.mergeOrUploadDocuments(
      batch.map((p) => {
        return {
          id: makeId(book.id, versionToIndex.source, versionId, p.index),
          book_id: book.id,
          book_version_id: `${versionToIndex.source}:${versionId}`,
          content: p.text,
          chapters: p.chaptersIndices,
          page: p.page!,
          volume: p.volume ? String(p.volume) : null,
          index: p.index,
        };
      }),
    );
  }

  await updateBookFlags(id, versionId);

  return { status: "success", id, versionId };
}
