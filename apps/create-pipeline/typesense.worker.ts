import type { TypesenseQueueData } from "@/queues/typesense/typesense-queue";
import type { SandboxedJob } from "bullmq";
import { indexAuthors } from "@/typesense/index-authors";
import { indexBooks } from "@/typesense/index-books";
import { indexTypesenseGenres } from "@/typesense/index-genres";
import { indexTypesenseRegions } from "@/typesense/index-regions";
import { indexTypesenseSearch } from "@/typesense/index-search";
import { ImportError } from "typesense/lib/Typesense/Errors";

export default async function typesenseWorker(
  job: SandboxedJob<TypesenseQueueData>,
) {
  try {
    // Index everything
    await indexAuthors();
    await job.updateProgress(20);

    await indexBooks();
    await job.updateProgress(40);

    await indexTypesenseGenres();
    await job.updateProgress(60);

    await indexTypesenseRegions();
    await job.updateProgress(80);

    await indexTypesenseSearch();
    await job.updateProgress(100);
  } catch (e) {
    if (e instanceof ImportError) {
      throw new Error(
        JSON.stringify({
          importResults: e.importResults,
          cause: e.cause,
        }),
      );
    }

    throw e;
  }

  return {
    success: true,
    completedAt: Date.now(),
  };
}
