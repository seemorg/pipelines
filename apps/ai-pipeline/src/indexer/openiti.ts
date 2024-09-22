import { env } from "@/env";
import { getOpenitiBookById, getPageText } from "@/lib/openiti";
import { attachOpenitiMetadataToNodes } from "@/lib/openiti-metadata";
import { getBooksData } from "@/lib/services/books";
import { ParseResult } from "@openiti/markdown-parser";
import {
  Document,
  SentenceSplitter,
  SimpleNodeParser,
  VectorStoreIndex,
} from "llamaindex";
import { stripHtml } from "string-strip-html";

import { chunk, removeDiacritics, sleep } from "@usul/utils";

import { createVectorIndex, createVectorStore } from "../lib/vector-store";

const versionsPriority = [
  "Shamela",
  "Sham19Y",
  "JK",
  "Sham30K",
  "Shia",
  "Zaydiyya",
  "ShamIbadiyya",
  "Tafsir",
  "ShamAY",
  "GRAR",
  "BibleCorpus",
  "Filaha",
  "Hindawi",
];

const getVersionName = (version: string) => {
  const parts = version.split(".");
  const name = parts[parts.length - 1]?.split("-")[0]?.replace("Vols", "");

  // remove numbers at the end
  if (name) {
    const id = name.replace(/\d+$/, "");
    return id;
  }

  return null;
};

const getHighestPriorityVersion = (versions: string[]) => {
  const sortedVersions = versions.sort((a, b) => {
    const nameA = getVersionName(a);
    const nameB = getVersionName(b);
    return versionsPriority.indexOf(nameA!) - versionsPriority.indexOf(nameB!);
  });

  return sortedVersions[0];
};

const splitter = new SentenceSplitter({
  splitLongSentences: true,
});
const parser = new SimpleNodeParser({
  textSplitter: splitter,
});

const index = await createVectorIndex("DEV");
const books = await getBooksData();

export async function getOpenitiNodes(params: {
  id: string;
  versionId?: string;
  overwrite?: boolean;
}) {
  const book = books.find((b) => b.id === params.id);

  if (!book) {
    return { status: "not-found" as const };
  }

  if (book && book.flags.aiSupported && !params.overwrite) {
    return { status: "skipped" as const };
  }

  const versions = book.versions.filter((v) => v.source === "openiti");

  if (!versions.length) {
    return {
      status: "no-version" as const,
    };
  }

  let openitiVersion = params.versionId;
  if (!openitiVersion) {
    const val = getHighestPriorityVersion(versions.map((v) => v.value));
    if (!val) {
      return {
        status: "no-version" as const,
      };
    }

    openitiVersion = val;
  }

  let openitiBook: ParseResult;
  try {
    openitiBook = await getOpenitiBookById(book.id, openitiVersion);
  } catch (e) {
    return {
      status: "error" as const,
      reason: "Failed to get book",
      error: e,
    };
  }

  const pages = openitiBook.content.map((page) => {
    const pageText = stripHtml(removeDiacritics(getPageText(page))).result;
    const text = splitter
      .splitText(pageText)
      .join(" ")
      .replaceAll("�", "")
      .replaceAll("\n\n\n", " ");

    return {
      volume: page.volume as number,
      page: page.page as number,
      text,
    };
  });

  const data = {
    slug: book.slug,
    data: {
      chapters: openitiBook.chapters,
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
    attachOpenitiMetadataToNodes(nodes, data);
  } catch (e) {
    return {
      status: "error" as const,
      reason: "Failed to attach metadata",
      error: e,
    };
  }

  return { status: "success" as const, nodes, versionId: openitiVersion };
}

export async function indexOpenitiBook(params: { id: string }) {
  const result = await getOpenitiNodes(params);

  if (result.status === "error") {
    return { status: "error", reason: result.reason, error: result.error };
  }

  if (result.status !== "success") {
    return result;
  }

  // await deleteNodesIfExist(client, slug);
  const batches = chunk(result.nodes, 80);
  let i = 1;

  for (const batch of batches) {
    const chunkBatches = chunk(batch, 10);
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

  return { status: "success", versionId: result.versionId };
}
