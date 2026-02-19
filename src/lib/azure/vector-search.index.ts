import type { SearchIndex } from "@azure/search-documents";
import { env } from "@/env";
import {
  AzureKeyCredential,
  SearchClient,
  SearchIndexClient,
} from "@azure/search-documents";

export interface BookChunk {
  id: string;
  book_id: string;
  book_version_id: string;
  prev_id?: string | null;
  next_id?: string | null;
  chunk_content: string;
  chunk_embedding: number[];
  chapters: number[]; // chapter indices
  pages: {
    index: number;
    page: number;
    volume?: string | null;
  }[];
}

const parsedIndexNames =
  env.AZURE_SEARCH_INDEXES?.split(",").map((name) => name.trim()).filter(Boolean);

const VECTOR_INDEX_NAMES =
  parsedIndexNames && parsedIndexNames.length > 0
    ? parsedIndexNames
    : [env.AZURE_SEARCH_INDEX];

const searchCredential = new AzureKeyCredential(env.AZURE_SEARCH_KEY);

export const vectorSearchClients = VECTOR_INDEX_NAMES.map(
  (indexName) =>
    new SearchClient<BookChunk>(
      env.AZURE_SEARCH_ENDPOINT,
      indexName,
      searchCredential,
    ),
);

// Backwards-compatible single-client export (primary index).
export const vectorSearchClient = vectorSearchClients[0]!;

const indexClient = new SearchIndexClient(
  env.AZURE_SEARCH_ENDPOINT,
  searchCredential,
);

const baseIndexDefinition: Omit<SearchIndex, "name"> = {
  fields: [
    { name: "id", type: "Edm.String", key: true },
    {
      name: "book_id",
      type: "Edm.String",
      filterable: true,
      facetable: true,
      searchable: false,
    },
    {
      name: "prev_id",
      type: "Edm.String",
      filterable: true,
      facetable: true,
      searchable: false,
    },
    {
      name: "next_id",
      type: "Edm.String",
      filterable: true,
      facetable: true,
      searchable: false,
    },
    {
      name: "book_version_id",
      type: "Edm.String",
      filterable: true,
      facetable: true,
      searchable: false,
    },
    {
      name: "chunk_content",
      type: "Edm.String",
      searchable: false,
    },
    {
      name: "chunk_embedding",
      type: "Collection(Edm.Single)",
      searchable: true,
      vectorSearchDimensions: 3072,
      vectorSearchProfileName: "vector-search-profile",
      stored: false,
    },
    {
      name: "chapters",
      type: "Collection(Edm.Int32)",
      filterable: true,
      facetable: true,
    },
    {
      type: "Collection(Edm.ComplexType)",
      name: "pages",
      fields: [
        {
          type: "Edm.Int32",
          name: "index",
          filterable: true,
        },
        {
          type: "Edm.Int32",
          name: "page",
          filterable: true,
        },
        {
          type: "Edm.String",
          name: "volume",
          searchable: false,
          filterable: true,
        },
      ],
    },
  ],
  vectorSearch: {
    algorithms: [{ name: "vector-search-algorithm", kind: "hnsw" }],
    vectorizers: [
      {
        vectorizerName: "vector-search-vectorizer",
        kind: "azureOpenAI",
        parameters: {
          resourceUrl: `https://${env.AZURE_OPENAI_RESOURCE_NAME}.cognitiveservices.azure.com/`,
          deploymentId: env.AZURE_EMBEDDINGS_DEPLOYMENT_NAME,
          modelName: "text-embedding-3-large",
        },
        // TODO: change auth strategy on azure to api
      },
    ],
    profiles: [
      {
        name: "vector-search-profile",
        algorithmConfigurationName: "vector-search-algorithm",
        vectorizerName: "vector-search-vectorizer",
      },
    ],
  },
};

const buildIndexDefinition = (name: string): SearchIndex => ({
  name,
  ...baseIndexDefinition,
});

export const createVectorSearchIndexesIfNotExist = async () => {
  for (const indexName of VECTOR_INDEX_NAMES) {
    const index = buildIndexDefinition(indexName);
    try {
      await indexClient.getIndex(index.name);
    } catch (error: any) {
      if (error?.code === "ENOTFOUND" || error?.statusCode === 404) {
        console.log(`Index ${index.name} not found, creating it now...`);
        await indexClient.createIndex(index);
        console.log(`Index ${index.name} created successfully!`);
      } else {
        console.log("An error occurred while checking the index!");
        console.log(error);
      }
    }
  }
};

// Backwards-compatible alias for existing callers.
export const createVectorSearchIndexIfNotExists =
  createVectorSearchIndexesIfNotExist;

/** Redis key for tracking when the primary index has hit storage quota. */
export const VECTOR_INDEX_PRIMARY_FULL_KEY = "vector-index:primary-full";

/**
 * Quota-based routing: use primary index until it hits storage limit, then fall back to books-2.
 * Checks Redis for "primary full" flag - when set, routes to the last index in the list.
 */
export const getVectorSearchClientForIndexing = async (
  _bookId: string,
  redis: { get: (key: string) => Promise<string | null> },
): Promise<(typeof vectorSearchClients)[0]> => {
  if (vectorSearchClients.length === 1) {
    return vectorSearchClients[0]!;
  }

  const primaryFull = await redis.get(VECTOR_INDEX_PRIMARY_FULL_KEY);
  if (primaryFull === "1") {
    return vectorSearchClients[vectorSearchClients.length - 1]!;
  }

  return vectorSearchClients[0]!;
};

/**
 * Marks the primary index as having hit storage quota. Subsequent indexings will use the fallback index.
 */
export const markPrimaryIndexFull = async (
  redis: { set: (key: string, value: string) => Promise<unknown> },
) => {
  await redis.set(VECTOR_INDEX_PRIMARY_FULL_KEY, "1");
};

/**
 * Returns true if the error appears to be a storage/quota limit error from Azure AI Search.
 */
export const isStorageQuotaError = (error: unknown): boolean => {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message)
      : "";
  const lower = message.toLowerCase();
  return (
    lower.includes("out of storage") ||
    lower.includes("storage") ||
    lower.includes("quota") ||
    lower.includes("maximum allowed size") ||
    lower.includes("partition limit")
  );
};

export const getVectorSearchClients = () => vectorSearchClients;
export const getVectorIndexNames = () => VECTOR_INDEX_NAMES;
