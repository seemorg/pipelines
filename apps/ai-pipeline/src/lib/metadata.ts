import type { TurathBookResponse } from "@usul/utils";
import { TextNode } from "llamaindex";

import { removeDiacritics } from "@usul/utils";

import {
  createPageToChapterIndex,
  getBookPositions,
  getChapterTitle,
} from "./utils";

export const attachMetadataToNodes = (
  nodes: TextNode[],
  book: {
    slug: string;
    data: {
      pages: TurathBookResponse["pages"];
      headings: TurathBookResponse["indexes"]["headings"];
      pageHeadings: TurathBookResponse["indexes"]["page_headings"];
    };
    concatenatedContent: string;
  },
) => {
  const positions = getBookPositions(book.data.pages);
  const pageIndexToChapterIndex = createPageToChapterIndex(
    book.data.pageHeadings,
  );

  // pre-process node
  // 1. set chapter & page number in metadata
  // 2. remove tashkeel
  let i = 0;
  for (const node of nodes) {
    i++;

    const matchedPageIndices = new Set<number>();

    const chunkStart = book.concatenatedContent.indexOf(
      node.text.replaceAll("�", ""),
    );
    const chunkEnd = chunkStart + node.text.length;

    if (chunkStart === -1) {
      console.log(`[NODE ${i} - ${node.id_}] Could not link metadata!`);
      throw new Error("Could not link metadata!");
    }

    positions
      .filter((pos) => pos.start <= chunkEnd && pos.end >= chunkStart)
      .forEach((p) => {
        matchedPageIndices.add(p.idx);
      });

    let startIndex = 0;

    // Iterate over each page's content to find overlaps
    book.data.pages.forEach((page, idx) => {
      const pageContent = page.text;
      let index = pageContent.indexOf(node.text, startIndex);

      // Check if the chunk overlaps with the current page content
      while (index !== -1) {
        matchedPageIndices.add(idx);
        startIndex = index + node.text.length;
        index = pageContent.indexOf(node.text, startIndex);
      }
    });

    const matchedIndicesArray = Array.from(matchedPageIndices);

    const _pageNumbers = matchedIndicesArray.map((idx) => ({
      page: book.data.pages[idx]!.page,
      vol: book.data.pages[idx]!.vol,
    }));

    // remove duplicates from pageNumbers
    const pageNumbersSet = new Set<string>();
    const pageNumbers = _pageNumbers.filter((page) => {
      const key = `${page.vol}-${page.page}`;
      if (pageNumbersSet.has(key)) {
        return false;
      }
      pageNumbersSet.add(key);
      return true;
    });

    const chapterTitles = [
      ...new Set(
        matchedIndicesArray.flatMap((idx) =>
          getChapterTitle(book.data.headings, idx, pageIndexToChapterIndex),
        ),
      ),
    ];

    node.metadata.chapters = chapterTitles.map(removeDiacritics);
    node.metadata.pages = pageNumbers;

    node.setContent(node.text);
  }
};
