import { indexBook } from "@/indexer/v1";
import { db } from "@/lib/db";
import { BookQueueData } from "@/queues/ai-indexer/queue";
import { SandboxedJob } from "bullmq";

const updateBookFlags = async (id: string, versionId: string) => {
  const book = await db.book.findUnique({
    where: { id },
    select: { id: true, flags: true, versions: true },
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
      flags: {
        ...book.flags,
        aiSupported: true,
        aiVersion: versionId,
      } as PrismaJson.BookFlags,
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
