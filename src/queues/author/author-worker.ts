import { removeDiacritics } from "@/utils";
import { Worker } from "bullmq";
import slugify from "slugify";

import type { AuthorQueueData } from "./author-queue";
import {
  getAuthorSlugs,
  getExistingTurathAuthorIds,
  getTurathAuthorsById,
} from "../../lib/data";
import { db } from "../../lib/db";
import {
  languages,
  languagesWithoutEnglishAndArabic,
} from "../../lib/languages";
import { generateBiography } from "../../stages/biography";
import { localizeName } from "../../stages/localization";
import { transliterateName } from "../../stages/transliteration";
import { generateVariations } from "../../stages/variations";
import { AUTHORS_QUEUE_NAME, AUTHORS_QUEUE_REDIS } from "./author-queue";

export const worker = new Worker<AuthorQueueData>(
  AUTHORS_QUEUE_NAME,
  async (job) => {
    const data = job.data;

    const isTurath = "turathId" in data;
    let arabicName: string;
    let slug: string;
    let transliteration: string | null = null;

    if (isTurath) {
      const turathId = data.turathId;
      const turathAuthorsById = await getTurathAuthorsById();
      const turathAuthor = turathAuthorsById[turathId];
      if (!turathAuthor) {
        throw new Error(`Turath author with id ${turathId} not found`);
      }

      const existingTurathAuthorIds = await getExistingTurathAuthorIds();
      if (existingTurathAuthorIds.has(turathId.toString())) {
        return { skipped: true };
      }

      arabicName = turathAuthor.name;
      existingTurathAuthorIds.add(turathId.toString());
    } else {
      arabicName = data.arabicName;
    }

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

    // 2. create slug
    if (isTurath) {
      const slugs = await getAuthorSlugs();
      const baseSlug = slugify(removeDiacritics(englishName), {
        lower: true,
        trim: true,
        // remove special characters
        remove: /[*+~.()'"!:@]/g,
      });

      slug = baseSlug;
      let i = 1;
      while (slugs.has(slug)) {
        slug = `${baseSlug}-${i}`;
        i++;
      }
      slugs.add(slug);
    } else {
      slug = data.slug;
    }

    // 3. localize name in other languages
    const localizedNames = (
      await Promise.all(
        languagesWithoutEnglishAndArabic.map(async (language) => {
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
    ).filter(
      (name): name is { locale: string; text: string } => name.text !== null,
    );

    if (isTurath) {
      // 4. transliterate name
      transliteration = await transliterateName(arabicName, "author");
    }

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
    ).filter(
      (name): name is { locale: string; text: string } => name.text !== null,
    );

    const finalData = {
      slug,
      primaryNames: [{ locale: "en", text: englishName }, ...localizedNames],
      variations,
      transliteration,
      bios,
    };

    if (!isTurath) {
      // this means the request is coming from the usul admin panel
      // so we need to update the author data
      const author = await db.author.findFirst({ where: { slug } });
      if (!author) {
        throw new Error(`Author with slug ${slug} not found`);
      }

      await db.author.update({
        where: { id: author.id },
        data: {
          primaryNameTranslations: {
            upsert: finalData.primaryNames.map((name) => ({
              where: {
                authorId_locale: { authorId: author.id, locale: name.locale },
              },
              update: { text: name.text },
              create: { text: name.text, locale: name.locale },
            })),
          },
          bioTranslations: {
            upsert: finalData.bios.map((bio) => ({
              where: {
                authorId_locale: { authorId: author.id, locale: bio.locale },
              },
              update: { text: bio.text },
              create: { text: bio.text, locale: bio.locale },
            })),
          },
        },
      });
    }

    return finalData;
  },
  {
    connection: AUTHORS_QUEUE_REDIS,
    concurrency: 5,
  },
);
