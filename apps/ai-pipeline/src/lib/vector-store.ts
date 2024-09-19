import { env } from "@/env";
import { QdrantClient } from "@qdrant/js-client-rest";
import { QdrantVectorStore, VectorStoreIndex } from "llamaindex";

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

let index: VectorStoreIndex;
export const createVectorIndex = async (_mode: "DEV" | "PROD" = "PROD") => {
  if (index) {
    return index;
  }

  const vectorStore = createVectorStore(_mode);

  let collectionExists = false;
  try {
    await vectorStore.client().getCollection(env.QDRANT_COLLECTION);
    collectionExists = true;
  } catch (e) {}
  if (!collectionExists) {
    console.log("Creating collection...");
    await vectorStore.createCollection(env.QDRANT_COLLECTION, 3072);
  }

  index = await VectorStoreIndex.fromVectorStore(vectorStore);
  return index;
};
