import { Worker } from "bullmq";

import type { TypesenseQueueData } from "./typesense-queue";
import { indexAuthors } from "../../typesense/index-authors";
import { indexBooks } from "../../typesense/index-books";
import { indexTypesenseGenres } from "../../typesense/index-genres";
import { indexTypesenseRegions } from "../../typesense/index-regions";
import { indexTypesenseSearch } from "../../typesense/index-search";
import { TYPESENSE_QUEUE_NAME, TYPESENSE_QUEUE_REDIS } from "./typesense-queue";

export const worker = new Worker<TypesenseQueueData>(
  TYPESENSE_QUEUE_NAME,
  async () => {
    // Index everything
    await indexAuthors();
    await indexBooks();
    await indexTypesenseGenres();
    await indexTypesenseRegions();
    await indexTypesenseSearch();

    return {
      success: true,
      completedAt: Date.now(),
    };
  },
  {
    connection: TYPESENSE_QUEUE_REDIS,
    concurrency: 1, // Ensure only one re-index job runs at a time
  },
);
