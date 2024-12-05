import type { BookQueueData } from "@/queues/ai-indexer/queue";
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

  // update book flags
  await db.book.update({
    where: {
      id: book.id,
    },
    data: {
      versions: book.versions.map((v) => ({
        ...v,
        ...(v.value === versionId ? { aiSupported: true } : {}),
      })),
    },
  });
};

export default async function aiIndexerWorker(
  job: SandboxedJob<BookQueueData>,
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
