import type { BookChunk } from "@/lib/azure/vector-search.index";
import type { Metadata, TextNode } from "llamaindex";
import { fetchBookContent, OcrBookResponse } from "@/book-fetchers";
import { OpenitiBookResponse } from "@/book-fetchers/openiti";
import { TurathBookResponse } from "@/book-fetchers/turath";
import {
  getVectorSearchClientForIndexing,
  isStorageQuotaError,
  markPrimaryIndexFull,
} from "@/lib/azure/vector-search.index";
import { createRedis } from "@/lib/redis";
import { db } from "@/lib/db";
import { embeddings } from "@/lib/openai";
import { chunk } from "@/utils";
import { Document } from "llamaindex";

import { attachMetadataToNodes, preparePages } from "./metadata";
import { splitter } from "./splitter";
import { JOIN_PAGES_DELIMITER } from "./utils";

const MAX_RETRIES = 3;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const makeChunkId = (
  bookId: string,
  versionSource: string,
  versionValue: string,
  idx: number,
) =>
  Buffer.from(`${bookId}:${versionSource}:${versionValue}:${idx}`).toString(
    "base64url",
  );

const retryWithDelay = async <T>(
  fn: () => Promise<T>,
  delayInSeconds: number,
  shouldRetry?: (e: any) => boolean,
): Promise<{ result: T; error: null } | { result: null; error: Error }> => {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return { result: await fn(), error: null };
    } catch (e: any) {
      // if it's the last retry or the error is not retryable, throw
      if (i === MAX_RETRIES - 1 || (shouldRetry && !shouldRetry(e))) {
        return { result: null, error: e };
      }

      await sleep(delayInSeconds * 1000);
    }
  }

  return { result: null, error: new Error("Exceeded max retries") };
};

const prepareContent = (
  bookContent: TurathBookResponse | OpenitiBookResponse | OcrBookResponse,
) => {
  if (bookContent.source === "turath") {
    const chapters = bookContent.turathResponse.headings;
    const pages = bookContent.turathResponse.pages;
    return {
      chapters,
      preparedPages: preparePages(pages, chapters),
    };
  }

  if (bookContent.source === "openiti") {
    const chapters = bookContent.chapters;
    const pages = bookContent.content;

    return {
      chapters,
      preparedPages: preparePages(pages, chapters),
    };
  }

  const chapters = bookContent.headings;
  const pages = bookContent.pages;

  return {
    chapters,
    preparedPages: preparePages(pages, chapters),
  };
};

type PreparedContent = ReturnType<typeof prepareContent>;

const groupPagesByChapter = (
  preparedPages: PreparedContent["preparedPages"],
  chapters: PreparedContent["chapters"],
) => {
  const level1ChaptersIndices = chapters.reduce((acc, heading, idx) => {
    if (heading.level === 1) {
      acc.push(idx);
    }
    return acc;
  }, [] as number[]);

  const pagesByChapter = level1ChaptersIndices.map((idx) =>
    preparedPages.filter((page) => page.chaptersIndices.includes(idx)),
  );

  return pagesByChapter;
};

export async function indexBook(
  params: ({ id: string } | { slug: string }) & {
    versionId: string;
  },
) {
  const book = await db.book.findFirst({
    where: "id" in params ? { id: params.id } : { slug: params.slug },
    select: {
      id: true,
      author: { select: { id: true } },
      versions: true,
    },
  });

  if (!book) {
    return { status: "not-found" };
  }

  const versionToIndex = book.versions.find(
    (v) => v.value === params.versionId,
  );
  if (!versionToIndex) {
    return { status: "not-found" };
  }

  const bookContent = await fetchBookContent(
    {
      id: book.id,
      author: { id: book.author.id },
      versions: book.versions,
    },
    versionToIndex.value,
  );

  if (
    !bookContent ||
    (bookContent.source !== "turath" &&
      bookContent.source !== "openiti" &&
      bookContent.source !== "pdf")
  ) {
    return { status: "skipped" };
  }

  console.log(
    `preparing pages for: ${versionToIndex.source}:${versionToIndex.value}`,
  );
  const { chapters, preparedPages } = prepareContent(bookContent);

  console.log("splitting text by chapters");
  const pagesByChapter = groupPagesByChapter(preparedPages, chapters);

  const nodes: TextNode<Metadata>[] = [];

  let chapterIdx = 0;
  for (const chapterPages of pagesByChapter) {
    console.log(`splitting chapter ${++chapterIdx} / ${pagesByChapter.length}`);

    if (chapterPages.length === 0) {
      continue;
    }

    const concatenatedContent = chapterPages
      .map((p) => p.text)
      .join(JOIN_PAGES_DELIMITER);

    const doc = new Document({
      metadata: {},
      text: concatenatedContent,
    });

    const chapterNodes = splitter.getNodesFromDocuments([doc]);
    console.log("Attaching metadata");

    try {
      attachMetadataToNodes(chapterNodes, chapterPages);
      nodes.push(...chapterNodes);
    } catch (e) {
      return {
        status: "error",
        reason: "Failed to attach metadata",
        error: e,
      };
    }
  }

  const redis = createRedis();
  let vectorClient: Awaited<ReturnType<typeof getVectorSearchClientForIndexing>>;
  try {
    vectorClient = await getVectorSearchClientForIndexing(book.id, redis);
  } catch (e) {
    redis.quit();
    throw e;
  }

  const batches = chunk(nodes, 30);
  let i = 0;

  const versionSource = versionToIndex.source;
  const versionValue = versionToIndex.value;

  let activeBatch = 0;
  try {
  for (const batch of batches) {
    console.log(`Embedding batch ${++activeBatch} / ${batches.length}`);

    // we first embed
    const embeddingsResult = await Promise.all(
      batch.map(async (node, idx): Promise<BookChunk> => {
        const embedding = await retryWithDelay(
          async () => {
            const response = await embeddings.create({
              input: node.text,
              model: "text-embedding-3-large",
            });
            return response.data[0]!.embedding;
          },
          10,
          // retry if the error is not about the context length
          (e) =>
            !e.message?.includes(
              "400 This model's maximum context length is 8192 tokens",
            ),
        );

        if (embedding.error) {
          throw embedding.error;
        }

        const nodeIdx = i * batches.length + idx;

        const prevId =
          nodeIdx > 0
            ? makeChunkId(book.id, versionSource, versionValue, nodeIdx - 1)
            : undefined;
        const nextId =
          nodeIdx < nodes.length - 1
            ? makeChunkId(book.id, versionSource, versionValue, nodeIdx + 1)
            : undefined;

        return {
          id: makeChunkId(book.id, versionSource, versionValue, nodeIdx),
          book_version_id: `${versionSource}:${versionValue}`,
          prev_id: prevId,
          next_id: nextId,
          chunk_embedding: embedding.result,
          chunk_content: node.text,
          book_id: book.id,
          chapters: node.metadata.chaptersIndices,
          pages: node.metadata.pages.map((p: any) => ({
            index: p.index,
            page: p.page ? String(p.page) : undefined,
            volume: p.volume ? String(p.volume) : undefined,
          })),
        };
      }),
    );

    try {
      await vectorClient.mergeOrUploadDocuments(embeddingsResult);
    } catch (error) {
      if (isStorageQuotaError(error)) {
        console.warn(
          "Primary vector index hit storage quota, marking as full for fallback to secondary index",
        );
        await markPrimaryIndexFull(redis);
        throw error;
      }
      throw error;
    }

    i++;
  }

  return { status: "success", versionId: versionToIndex.value };
  } finally {
    redis.quit();
  }
}
