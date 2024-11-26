import { client } from "@/lib/typesense";

import { chunk } from "@usul/utils";

import nameAliases from "./data/author-aliases.json";

export const indexAuthorAliases = async (collection: string) => {
  const typedAliases = nameAliases as Record<string, string[]>;
  const aliases = Object.keys(typedAliases)
    .filter((a) => !!typedAliases[a] && (typedAliases[a]?.length ?? 0) > 0)
    .map((alias) => ({
      name: alias,
      aliases: [alias, ...typedAliases[alias]!] as string[],
    }));

  const aliasChunks = chunk(aliases, 50);

  let j = 1;
  for (const batch of aliasChunks) {
    console.log(`Indexing aliases batch ${j} / ${aliasChunks.length}`);
    await Promise.all(
      batch.map((a, index) =>
        client
          .collections(collection)
          .synonyms()
          .upsert(`chunk-${j}:idx-${index}`, { synonyms: a.aliases }),
      ),
    );
    j++;
  }
};
