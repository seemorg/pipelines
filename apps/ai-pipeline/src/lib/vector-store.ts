import { env } from "@/env";
import { QdrantClient } from "@qdrant/js-client-rest";
import { QdrantVectorStore } from "llamaindex";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const createVectorStore = (_mode: "DEV" | "PROD" = "PROD") => {
  const client = new QdrantClient({
    url: env.QDRANT_URL,
    apiKey: env.QDRANT_API_KEY,
    port: 443,
    https: true,
  });

  return new QdrantVectorStore({
    collectionName: env.QDRANT_COLLECTION,
    client: client,
  });
};
