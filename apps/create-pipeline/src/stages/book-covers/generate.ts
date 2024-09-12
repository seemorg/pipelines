import { listAllObjects, uploadToR2 } from "@/lib/r2";

import { getBookHtml } from "./utils/html";
import { generatePatternWithColors } from "./utils/pattern";
import { getScreenshot } from "./utils/screenshot";

const objects = new Set<string>(
  (await listAllObjects("covers/")).map((o) => o.Key ?? ""),
);

const patternObjects = new Set<string>(
  (await listAllObjects("patterns/")).map((o) => o.Key ?? ""),
);

const PUBLIC_URL_BASE = "https://assets.usul.ai/";

export const generateBookCoverAndUploadToR2 = async ({
  slug,
  name,
  authorName,
  override,
}: {
  slug: string;
  name: string; // arabic
  authorName: string; // arabic
  override?: boolean;
}) => {
  const coverKey = `covers/${slug}.png`;
  if (objects.has(coverKey) && !override) {
    return { success: true, url: `${PUBLIC_URL_BASE}${coverKey}` };
  }

  try {
    const result = await generatePatternWithColors(
      slug,
      override ? new Set() : patternObjects,
    );
    if (!result) return;

    const { containerColor, patternBuffer } = result;

    const bgBase64 = patternBuffer.toString("base64");

    // console.log('Generating cover...');
    const file = await getScreenshot(
      getBookHtml({
        title: name,
        author: authorName ?? "",
        containerColor,
        bgBase64,
      }),
      "png",
    );

    // console.log('Uploading cover...');
    await uploadToR2(coverKey, file, {
      contentType: "image/png",
    });

    return { success: true, url: `${PUBLIC_URL_BASE}${coverKey}` };
  } catch (e) {
    return { success: false, error: e };
  }
};
