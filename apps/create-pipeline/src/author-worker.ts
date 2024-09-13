import { Worker } from "bullmq";
import slugify from "slugify";

import { removeDiacritics } from "@usul/utils";

import type { AuthorQueueData } from "./author-queue";
import { AUTHORS_QUEUE_NAME, AUTHORS_QUEUE_REDIS } from "./author-queue";
import {
  getAuthorSlugs,
  getExistingTurathAuthorIds,
  getTurathAuthorsById,
} from "./lib/data";
import { languages, languagesWithoutEnglish } from "./lib/languages";
import { generateBiography } from "./stages/biography";
import { localizeName } from "./stages/localization";
import { transliterateName } from "./stages/transliteration";
import { generateVariations } from "./stages/variations";

export const worker = new Worker<AuthorQueueData>(
  AUTHORS_QUEUE_NAME,
  async (job) => {
    const { turathId } = job.data;

    const turathAuthorsById = await getTurathAuthorsById();
    const turathAuthor = turathAuthorsById[turathId];
    if (!turathAuthor) {
      throw new Error(`Turath author with id ${turathId} not found`);
    }

    const existingTurathAuthorIds = await getExistingTurathAuthorIds();
    if (existingTurathAuthorIds.has(turathId.toString())) {
      return { skipped: true };
    }

    const arabicName = turathAuthor.name;

    // 1. localize name
    const englishName = await localizeName(
      {
        primaryArabicName: arabicName,
      },
      "author",
      "en",
    );

    if (!englishName) {
      throw new Error("Failed to localize name");
    }

    const slugs = await getAuthorSlugs();
    // 2. create slug
    const baseSlug = slugify(removeDiacritics(englishName), {
      lower: true,
      trim: true,
      // remove special characters
      remove: /[*+~.()'"!:@]/g,
    });

    let slug = baseSlug;
    let i = 1;
    while (slugs.has(slug)) {
      slug = `${baseSlug}-${i}`;
      i++;
    }
    slugs.add(slug);

    // 3. localize name in other languages
    const localizedNames = (
      await Promise.all(
        languagesWithoutEnglish.map(async (language) => {
          return {
            locale: language.code,
            text: await localizeName(
              {
                primaryArabicName: arabicName,
                primaryLatinName: englishName,
              },
              "author",
              language.code,
            ),
          };
        }),
      )
    ).filter((name) => name.text !== null);

    // 4. transliterate name
    const transliteration = await transliterateName(arabicName, "author");

    // 5. create variations in each language
    const variations = await generateVariations(englishName, "author");

    // 6. generate bios
    const bios = (
      await Promise.all(
        languages.map(async (language) => {
          return {
            locale: language.code,
            text: await generateBiography(
              {
                primaryArabicName: arabicName,
                primaryLatinName: englishName,
              },

              language.code,
            ),
          };
        }),
      )
    ).filter((name) => name.text !== null);

    existingTurathAuthorIds.add(turathId.toString());

    return {
      slug,
      primaryNames: [{ locale: "en", text: englishName }, ...localizedNames],
      variations,
      transliteration,
      bios,
    };
  },
  {
    connection: AUTHORS_QUEUE_REDIS,
    concurrency: 10,
  },
);
