import { getLanguageByCode } from "@/lib/languages";
import { openai } from "@/lib/openai";
import { z } from "zod";

const SYSTEM_PROMPT = (type: "book" | "author", language: string) => {
  if (type === "author")
    return `
You are an assistant that takes a JSON about a prominent historical figure as input, and returns the ${language} name of the figure.

Sample Output:
{
  "primaryName": "..."
}
`.trim();

  return `
You are an assistant that takes a JSON about a book as input, and returns the ${language} name of the book.

Sample Output:
{
  "primaryName": "..."
}
`.trim();
};

const schema = z.object({
  primaryName: z.string(),
});

export const localizeName = async (
  entity: {
    primaryArabicName: string;
    primaryLatinName?: string;
    otherArabicNames?: string[];
    otherLatinNames?: string[];
  },
  type: "book" | "author",
  locale: string,
): Promise<string | null> => {
  const language = getLanguageByCode(locale);
  if (!language) return null;

  const completion = await openai.chat.completions.create({
    model: "",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT(type, language.code) },
      { role: "user", content: JSON.stringify(entity, null, 2) },
    ],
  });

  const result = completion.choices[0]?.message.content;
  if (!result) return null;

  const parsedResult = schema.safeParse(JSON.parse(result));
  if (!parsedResult.success) return null;

  return parsedResult.data.primaryName;
};
