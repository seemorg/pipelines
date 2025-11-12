import { client } from "@/lib/typesense";
import { chunk } from "@/utils";

import { cleanupOldCollections, swapAlias } from "./collection-utils";
import { indexAuthorAliases } from "./index-author-aliases";
import {
  BATCH_SIZE,
  COLLECTION_NAME,
  prepareTypesenseAuthorsData,
  TYPESENSE_AUTHOR_SCHEMA,
} from "./schema/author";

export const indexAuthors = async () => {
  const INDEX_NAME = `${COLLECTION_NAME}_${Date.now()}`;
  const documents = await prepareTypesenseAuthorsData();

  // Check if alias exists, if not, try to delete any old collection with the base name
  let hasCollectionAliases = true;
  try {
    await client.aliases(COLLECTION_NAME).retrieve();
  } catch (e) {
    hasCollectionAliases = false;
  }

  if (!hasCollectionAliases) {
    try {
      await client.collections(COLLECTION_NAME).delete();
    } catch (e) {
      // Collection doesn't exist, that's fine
    }
  }

  await client.collections().create(TYPESENSE_AUTHOR_SCHEMA(INDEX_NAME));

  const batches = chunk(documents, BATCH_SIZE);

  let i = 1;
  for (const batch of batches) {
    console.log(`Indexing batch ${i} / ${batches.length}`);

    await client
      .collections(INDEX_NAME)
      .documents()
      .import(batch, { action: "upsert" });

    // Small delay to reduce write load on Typesense server
    if (i < batches.length) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    i++;
  }
  console.log(`Indexed ${documents.length} authors`);
  console.log("\n");

  // Swap alias to point to new collection and delete old one
  await swapAlias(COLLECTION_NAME, INDEX_NAME);

  // Clean up any orphaned collections (keep only latest 2 versions)
  // Exclude the current collection to be extra safe
  await cleanupOldCollections(COLLECTION_NAME, 2, INDEX_NAME);

  await indexAuthorAliases(INDEX_NAME);
};
