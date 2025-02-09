import { client } from "@/lib/typesense";
import { chunk, dedupeStrings, getNamesVariations } from "@/utils";

import nameAliases from "./data/book-aliases.json";

export const indexBookAliases = async (collection: string) => {
  const typedAliases = nameAliases as Record<
    string,
    {
      en: string[];
    }
  >;

  const aliases = Object.keys(typedAliases)
    .filter(
      (a) =>
        !!typedAliases[a] &&
        Object.keys(typedAliases[a]!).length > 0 &&
        typedAliases[a]!.en.length > 0,
    )
    .map((alias) => ({
      name: alias,
      aliases: dedupeStrings([
        alias,
        ...getNamesVariations(Object.values(typedAliases[alias]!).flat()),
      ] as string[]),
    }));

  const aliasChunks = chunk(aliases, 30);

  let j = 1;
  for (const batch of aliasChunks) {
    console.log(`Indexing aliases batch ${j} / ${aliasChunks.length}`);

    try {
      await Promise.all(
        batch.map((a, index) =>
          client
            .collections(collection)
            .synonyms()
            .upsert(`chunk-${j}:idx-${index}`, { synonyms: a.aliases }),
        ),
      );
    } catch (e) {}

    j++;
  }

  console.log(`Indexed ${aliases.length} aliases`);
};
