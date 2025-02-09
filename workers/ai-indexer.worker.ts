import type { AiIndexerQueueData } from "@/queues/ai-indexer/queue";
import type { SandboxedJob } from "bullmq";
import { indexBook } from "@/indexer/v1";
import { db } from "@/lib/db";

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
      version.aiSupported = true;
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

export default async function aiIndexerWorker(
  job: SandboxedJob<AiIndexerQueueData>,
) {
  const { id, versionId } = job.data;

  const result = await indexBook({ id, versionId });
  if (result.status !== "success" && result.status !== "skipped") {
    throw new Error(JSON.stringify(result));
  }

  if (result.status === "success") {
    await updateBookFlags(id, result.versionId!);
  }

  return result;
}
