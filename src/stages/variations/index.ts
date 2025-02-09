import { openai } from "@/lib/openai";
import { z } from "zod";

const SYSTEM_PROMPT = (type: "book" | "author") => {
  return `
You are an assistant that takes an English name of a arabic/islamic ${type} as input, and returns a json with different variations of that name in english. Variations include: short forms (if they're popular or famous with that name), full names, and different transliterations with diacritics. Don't include duplicates.
  
The schema should match the following: 
{
  "variations": ["Al-Suyūṭī", "Ǧalāl al-Dīn al-Suyūṭī", "Jalaal al-Deen al-Suyooti", "Jalal al-Din al-Suyuti", "Jalal al-Din al-Suyooti"]
}

The more popular names should appear first in the array.
`.trim();
};

const schema = z.object({
  variations: z.array(z.string()),
});

export const generateVariations = async (
  englishName: string,
  type: "book" | "author",
): Promise<string[] | null> => {
  const completion = await openai.chat.completions.create({
    model: "",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT(type) },
      { role: "user", content: `"${englishName}"` },
    ],
  });

  const result = completion.choices[0]?.message.content;
  if (!result) return null;

  const parsedResult = schema.safeParse(JSON.parse(result));
  if (!parsedResult.success) return null;

  return parsedResult.data.variations;
};
