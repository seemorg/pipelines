import { client } from "@/lib/typesense";

import { chunk } from "@usul/utils";

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

  let hasCollectionAliases = true;
  try {
    await client.aliases(COLLECTION_NAME).retrieve();
  } catch (e) {
    hasCollectionAliases = false;
  }

  if (!hasCollectionAliases) {
    try {
      await client.collections(COLLECTION_NAME).delete();
    } catch (e) {}
  }

  await client.collections().create(TYPESENSE_AUTHOR_SCHEMA(INDEX_NAME));

  const batches = chunk(documents, BATCH_SIZE);

  let i = 1;
  for (const batch of batches) {
    console.log(`Indexing batch ${i} / ${batches.length}`);

    await client.collections(INDEX_NAME).documents().import(batch);

    i++;
  }
  console.log(`Indexed ${documents.length} authors`);
  console.log("\n");

  try {
    const collection = await client.aliases(COLLECTION_NAME).retrieve();

    console.log("Deleting old alias...");
    await client.collections(collection.collection_name).delete();
  } catch (e) {}

  console.log("Linking new collection to alias...");
  await client
    .aliases()
    .upsert(COLLECTION_NAME, { collection_name: INDEX_NAME });

  await indexAuthorAliases(INDEX_NAME);
};
