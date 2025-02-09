import type { Options } from "tsup";
import { defineConfig } from "tsup";

export default defineConfig((options: Options) => ({
  entryPoints: [
    "src/index.ts",
    "workers/ai-indexer.worker.ts",
    "workers/keyword-indexer.worker.ts",
    "workers/typesense.worker.ts",
  ],
  clean: true,
  format: "esm",
  platform: "node",
  target: "node20",
  sourcemap: true,
  ...options,
}));
