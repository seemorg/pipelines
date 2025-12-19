import type { TypesenseQueueData } from "@/queues/typesense/queue";
import type { SandboxedJob } from "bullmq";
import type ImportError from "typesense/lib/Typesense/Errors/ImportError.js";
import { purgeAllCloudflareCache } from "@/lib/cloudflare";
import { indexAuthors } from "@/typesense/index-authors";
import { indexBooks } from "@/typesense/index-books";
import { indexTypesenseGenres } from "@/typesense/index-genres";
import { indexTypesenseAdvancedGenres } from "@/typesense/index-advanced-genres";
import { indexTypesenseRegions } from "@/typesense/index-regions";
import { indexTypesenseSearch } from "@/typesense/index-search";
import { indexTypesenseEmpires } from "@/typesense/index-empires";

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
    await job.updateProgress(50);

    await indexTypesenseAdvancedGenres();
    await job.updateProgress(60);

    await indexTypesenseRegions();
    await job.updateProgress(70);

    await indexTypesenseEmpires();
    await job.updateProgress(80);

    await indexTypesenseSearch();
    await job.updateProgress(100);

    console.log("Typesense indexing completed");
  } catch (e: any) {
    if ("importResults" in e) {
      throw new Error(
        JSON.stringify({
          importResults: (e as ImportError).importResults,
          cause: (e as ImportError).cause,
          message: (e as ImportError).message,
        }),
      );
    }

    throw e;
  }

  if (job.data.clearCloudflareCache) {
    await purgeAllCloudflareCache();
  }

  return {
    success: true,
    completedAt: Date.now(),
  };
}
