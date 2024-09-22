import { env } from "@/env";
import { getBooksData } from "@/lib/services/books";
import {
  Document,
  SentenceSplitter,
  SimpleNodeParser,
  VectorStoreIndex,
} from "llamaindex";
import { stripHtml } from "string-strip-html";

import { chunk, getTurathBookById, removeDiacritics, sleep } from "@usul/utils";

import { attachMetadataToNodes } from "../lib/metadata";
import { createVectorIndex } from "../lib/vector-store";

const splitter = new SentenceSplitter({
  splitLongSentences: true,
});
const parser = new SimpleNodeParser({
  textSplitter: splitter,
});

const index = await createVectorIndex("DEV");
const books = await getBooksData();

export async function indexTurathBook(
  params: { id: string } | { turathId: string },
) {
  // const client = vectorStore.client();
  let book: (typeof books)[number] | undefined;
  if ("id" in params) {
    book = books.find((b) => b.id === params.id);
  } else {
    book = books.find(
      (b) =>
        !!b.versions.find(
          (v) => v.source === "turath" && v.value === params.turathId,
        ),
    );
  }

  if (!book) {
    return { status: "not-found" };
  }

  if (book && book.flags.aiSupported) {
    return { status: "skipped" };
  }

  const versions = book.versions.filter((v) => v.source === "turath");
  const turathId = (versions.length === 1 ? versions[0] : versions[1])!.value;

  const turathBook = await getTurathBookById(turathId);

  const pages = turathBook.pages.map((p) => {
    const pageText = stripHtml(removeDiacritics(p.text)).result;
    const text = splitter
      .splitText(pageText)
      .join(" ")
      .replaceAll("�", "")
      .replaceAll("\n\n\n", " ");

    return {
      ...p,
      text,
    };
  });

  const data = {
    slug: book.slug,
    data: {
      headings: turathBook.indexes.headings,
      pageHeadings: turathBook.indexes.page_headings,
      pages,
    },
    concatenatedContent: pages.map((p) => p.text).join(" "),
  };

  const document = new Document({
    metadata: {
      bookSlug: book.slug,
    },
    text: data.concatenatedContent,
  });
  const nodes = parser.getNodesFromDocuments([document]);

  try {
    attachMetadataToNodes(nodes, data);
  } catch (e) {
    return { status: "error", reason: "Failed to attach metadata", error: e };
  }

  // await deleteNodesIfExist(client, slug);
  const batches = chunk(nodes, 80) as (typeof nodes)[];
  let i = 1;

  for (const batch of batches) {
    const chunkBatches = chunk(batch, 10) as (typeof batch)[];
    await Promise.all(
      chunkBatches.map(async (batch, chunkI) => {
        let success = false;
        while (!success) {
          try {
            await index.insertNodes(batch);
            success = true;
          } catch (e: any) {
            if (
              e.message?.includes(
                "400 This model's maximum context length is 8192 tokens",
              )
            ) {
              throw e;
            }

            console.error(
              `Failed to insert batch (${i} -> ${chunkI}) / ${batches.length}. (${e.message})`,
            );
            // sleep for 10s
            await sleep(10);
          }
        }
      }),
    );
    i++;
  }

  return { status: "success", versionId: turathBook.meta.id };
}
