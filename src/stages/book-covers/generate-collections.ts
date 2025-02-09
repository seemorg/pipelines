import fs from "fs/promises";
import path from "path";
import { ensureDir } from "@/utils";
import slugify from "slugify";

import { collections } from "./utils/collections";
import { getCollectionHtml } from "./utils/html";
import { generatePatternWithColors } from "./utils/pattern";
import { getScreenshot } from "./utils/screenshot";

const allSlugs = new Set(
  collections.map((collection) => slugify(collection.name, { lower: true })),
);

export const generateCollectionCover = async ({
  collection,
}: {
  collection: (typeof collections)[number];
}) => {
  const coverKey = `${slugify(collection.name, { lower: true })}.png`;

  try {
    const result = await generatePatternWithColors(coverKey, allSlugs);
    if (!result) return;

    const { containerColor, patternBuffer } = result;

    const bgBase64 = patternBuffer.toString("base64");

    // console.log('Generating cover...');
    const file = await getScreenshot(
      getCollectionHtml({
        title: collection.arabicName,
        containerColor,
        bgBase64,
      }),
      "png",
      { width: 1000, height: 1000 },
    );

    // console.log('Uploading cover...');
    await ensureDir(path.resolve("generated"));
    await ensureDir(path.resolve("generated/collections"));

    await fs.writeFile(path.resolve(`generated/collections/${coverKey}`), file);

    return {
      success: true,
    };
  } catch (e) {
    console.log(e);
    return {
      success: false,
      error: e,
    };
  }
};
