import { client } from "@/lib/typesense";
import { chunk } from "@/utils";

import {
  BATCH_SIZE,
  COLLECTION_NAME,
  prepareTypesenseRegionsData,
  TYPESENSE_REGION_SCHEMA,
} from "./schema/region";

export const indexTypesenseRegions = async () => {
  const INDEX_NAME = `${COLLECTION_NAME}_${Date.now()}`;
  const documents = await prepareTypesenseRegionsData();

  console.log(`Creating ${COLLECTION_NAME} index...`);

  let hasCollectionAliases = true;
  try {
    await client.aliases(COLLECTION_NAME).retrieve();
  } catch (e) {
    hasCollectionAliases = false;
  }

  if (!hasCollectionAliases) {
    try {
      await client.collections(COLLECTION_NAME).delete();
    } catch (e) { }
  }

  await client.collections().create(TYPESENSE_REGION_SCHEMA(INDEX_NAME));

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

  console.log(`Indexed ${documents.length} ${COLLECTION_NAME}`);

  try {
    const collection = await client.aliases(COLLECTION_NAME).retrieve();

    console.log("Deleting old alias...");
    await client.collections(collection.collection_name).delete();
  } catch (e) { }

  console.log("Linking new collection to alias...");
  await client
    .aliases()
    .upsert(COLLECTION_NAME, { collection_name: INDEX_NAME });
};
