import type { TurathBookResponse } from "@usul/utils";
import { env } from "@/env";
import { QdrantClient } from "@qdrant/js-client-rest";

import { sleep } from "@usul/utils";

export const createPageToChapterIndex = (
  pageHeadings: TurathBookResponse["indexes"]["page_headings"],
) => {
  const index = Object.entries(pageHeadings).reduce(
    (acc, curr) => {
      const [pageIndex, headingIndices] = curr;
      acc[Number(pageIndex) - 1] = headingIndices.map((i) => i - 1);
      return acc;
    },
    {} as Record<number, number[]>,
  );

  return index;
};

export const getBookPositions = (pages: TurathBookResponse["pages"]) => {
  // Step 3: Create a list of positions for each page's content in the concatenated string
  const value = pages.reduce(
    (acc, item, idx) => {
      const start = acc.length > 0 ? acc[acc.length - 1]!.end + 1 : 0; // Add 2 for the space delimiter
      const end = start + item.text.length;
      acc.push({ page: item.page, vol: item.vol, start, end, idx });
      return acc;
    },
    [] as {
      page: number;
      vol: string;
      start: number;
      idx: number;
      end: number;
    }[],
  );

  return value;
};

export const getChapterTitle = (
  headings: TurathBookResponse["indexes"]["headings"],
  pageIndex: number,
  pageIndexToChapterIndex: ReturnType<typeof createPageToChapterIndex>,
) => {
  // book.indexes.pages_headings is Record<string, number[]> (index of page + 1 -> index of header + 1)
  let chaptersIndex: number[] = [];
  for (const [page, indices] of Object.entries(pageIndexToChapterIndex)) {
    if (Number(page) <= pageIndex) {
      chaptersIndex = indices;
    } else {
      break;
    }
  }

  const titles: string[] = [];
  chaptersIndex.forEach((i) => {
    const h = headings[i];
    if (h) titles.push(h.title);
  });

  return titles;
};

export // check if some nodes with the same slug are already indexed
const deleteNodesIfExist = async (client: QdrantClient, slug: string) => {
  let success = false;
  let hasPoints = false;
  while (!success) {
    try {
      const existingNodes = await client.scroll(env.QDRANT_COLLECTION, {
        limit: 1,
        filter: {
          must: [
            {
              key: "bookSlug",
              match: {
                value: slug,
              },
            },
          ],
        },
      });
      success = true;
      hasPoints = existingNodes.points.length > 0;
    } catch (e) {
      console.error("Failed to fetch points from vector DB.");
      await sleep(10);
    }
  }

  if (hasPoints) {
    console.log(`Book ${slug} already indexed. Deleting previous nodes...`);

    let successDelete = false;
    while (!successDelete) {
      try {
        await client.delete(env.QDRANT_COLLECTION, {
          wait: true,
          filter: { must: [{ key: "bookSlug", match: { value: slug } }] },
        });
        successDelete = true;
      } catch (e) {
        console.error("Failed to delete nodes from vector DB.");
        await sleep(10);
      }
    }
  }
};
