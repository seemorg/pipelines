import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "../lib/db";
import { aiIndexerQueue } from "../queues/ai-indexer/queue";
import { keywordIndexerQueue } from "../queues/keyword-indexer/queue";
import { chunk } from "../utils";

const BULK_ADD_CHUNK_SIZE = 50;
const UI_BASE_PATH = "/ui";

const indexAllRoutes = new Hono();

indexAllRoutes.get("/", (c) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Index all</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 2rem auto; padding: 0 1rem; }
    h1 { font-size: 1.25rem; }
    p { color: #666; margin-bottom: 1.5rem; }
    .buttons { display: flex; flex-direction: column; gap: 0.75rem; }
    button { padding: 0.75rem 1rem; font-size: 1rem; cursor: pointer; border: 1px solid #ccc; border-radius: 6px; background: #f5f5f5; }
    button:hover { background: #e5e5e5; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .result { margin-top: 1rem; padding: 0.75rem; border-radius: 6px; font-size: 0.875rem; }
    .result.success { background: #e8f5e9; }
    .result.error { background: #ffebee; }
    a { color: #1976d2; }
  </style>
</head>
<body>
  <h1>Index all books</h1>
  <p>Queue jobs to index every book version into the vector DB (embeddings) and/or the keyword search index.</p>
  <div class="buttons">
    <button type="button" data-type="vector">Index all (vector DB)</button>
    <button type="button" data-type="keywords">Index all (keywords)</button>
    <button type="button" data-type="both">Index all (vector + keywords)</button>
  </div>
  <div id="result"></div>
  <p><a href="${UI_BASE_PATH}/">← Back to Bull Dashboard</a></p>
  <script>
    document.querySelectorAll('button[data-type]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const type = btn.dataset.type;
        btn.disabled = true;
        const resultEl = document.getElementById('result');
        resultEl.className = 'result';
        resultEl.textContent = 'Adding jobs…';
        try {
          const res = await fetch('${UI_BASE_PATH}/index', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || res.statusText);
          resultEl.className = 'result success';
          resultEl.textContent = 'Added: ' + (data.aiIndexer != null ? 'vector ' + data.aiIndexer + ' jobs. ' : '') + (data.keywordIndexer != null ? 'keywords ' + data.keywordIndexer + ' jobs.' : '');
        } catch (e) {
          resultEl.className = 'result error';
          resultEl.textContent = e.message || 'Request failed';
        }
        btn.disabled = false;
      });
    });
  </script>
</body>
</html>
  `.trim();
  return c.html(html);
});

indexAllRoutes.post(
  "/",
  zValidator(
    "json",
    z.object({
      type: z.enum(["vector", "keywords", "both"]),
    }),
  ),
  async (c) => {
    const { type } = c.req.valid("json");
    const books = await db.book.findMany({
      select: { id: true, versions: true },
    });
    const jobs = books.flatMap((book) =>
      book.versions.map((v) => ({
        bookId: book.id,
        versionId: v.value,
      })),
    );
    let aiCount = 0;
    let keywordCount = 0;
    if (type === "vector" || type === "both") {
      for (const batch of chunk(jobs, BULK_ADD_CHUNK_SIZE)) {
        await aiIndexerQueue.addBulk(
          batch.map((j) => ({
            name: `index_${j.bookId}_${j.versionId}`,
            data: { id: j.bookId, versionId: j.versionId },
          })),
        );
        aiCount += batch.length;
      }
    }
    if (type === "keywords" || type === "both") {
      for (const batch of chunk(jobs, BULK_ADD_CHUNK_SIZE)) {
        await keywordIndexerQueue.addBulk(
          batch.map((j) => ({
            name: `index_${j.bookId}_${j.versionId}`,
            data: { id: j.bookId, versionId: j.versionId },
          })),
        );
        keywordCount += batch.length;
      }
    }
    return c.json({
      aiIndexer: type === "vector" || type === "both" ? aiCount : undefined,
      keywordIndexer: type === "keywords" || type === "both" ? keywordCount : undefined,
    });
  },
);

export default indexAllRoutes;
