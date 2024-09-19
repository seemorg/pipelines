import { ParseResult } from "@openiti/markdown-parser";
import { TextNode } from "llamaindex";

import { removeDiacritics } from "@usul/utils";

type Page = { text: string; volume: number; page: number };

export const getBookPositions = (pages: Page[]) => {
  // Step 3: Create a list of positions for each page's content in the concatenated string
  const value = pages.reduce(
    (acc, item, idx) => {
      const start = acc.length > 0 ? acc[acc.length - 1]!.end + 1 : 0; // Add 2 for the space delimiter
      const end = start + item.text.length;
      acc.push({ page: item.page, volume: item.volume, start, end, idx });
      return acc;
    },
    [] as {
      page: number;
      volume: number;
      start: number;
      idx: number;
      end: number;
    }[],
  );

  return value;
};

const createPageNumberToIndex = (pages: Page[]) => {
  return pages.reduce(
    (acc, page, idx) => {
      acc[`${page.volume}-${page.page}`] = idx;
      return acc;
    },
    {} as Record<string, number>,
  );
};

const createPageToChapterIndex = (
  chapters: ParseResult["chapters"],
  pageNumberAndVolToIndex: Record<string, number>,
) => {
  // map chapter's page number to index
  // group them by page index
  const index = Object.entries(pageNumberAndVolToIndex).reduce(
    (acc, curr) => {
      const [pageNumberAndVol, pageIndex] = curr;
      const [vol, pageNumber] = pageNumberAndVol.split("-").map(Number);

      const pageChapters = chapters.filter(
        (c) => c.volume === vol && c.page === pageNumber,
      );

      acc[pageIndex] = pageChapters;

      return acc;
    },
    {} as Record<number, ParseResult["chapters"]>,
  );
  return index;
};

export const attachOpenitiMetadataToNodes = (
  nodes: TextNode[],
  book: {
    slug: string;
    data: {
      chapters: ParseResult["chapters"];
      pages: Page[];
    };
    concatenatedContent: string;
  },
) => {
  const positions = getBookPositions(book.data.pages);
  const pageNumberToIndex = createPageNumberToIndex(book.data.pages);
  const pageIndexToChapters = createPageToChapterIndex(
    book.data.chapters,
    pageNumberToIndex,
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
      volume: book.data.pages[idx]!.volume,
    }));

    // remove duplicates from pageNumbers
    const pageNumbersSet = new Set<string>();
    const pageNumbers = _pageNumbers.filter((page) => {
      const key = `${page.volume}-${page.page}`;
      if (pageNumbersSet.has(key)) {
        return false;
      }
      pageNumbersSet.add(key);
      return true;
    });

    const chapterTitles = [
      ...new Set(
        matchedIndicesArray.flatMap((idx) =>
          (pageIndexToChapters[idx] ?? []).map((c) => c.title),
        ),
      ),
    ];

    node.metadata.chapters = chapterTitles.map(removeDiacritics);
    node.metadata.pages = pageNumbers;

    node.setContent(node.text);
  }
};
