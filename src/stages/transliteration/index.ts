import { openai } from "@/lib/openai";
import { z } from "zod";

const SYSTEM_PROMPT = (type: string) =>
  `
You are an assistant that helps Islamic researchers. You take an Arabic/Islamic ${type} name as input, and return a json with the english transliteration in IJMES format.
  
The schema should match the following: 
{
  "transliteration": String
}
`.trim();

const schema = z.object({
  transliteration: z.string(),
});

export const transliterateName = async (
  name: string,
  type: "book" | "author",
): Promise<string | null> => {
  const completion = await openai.chat.completions.create({
    model: "",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT(type) },
      { role: "user", content: `"${name}"` },
    ],
  });

  const result = completion.choices[0]?.message.content;
  if (!result) return null;

  const parsedResult = schema.safeParse(JSON.parse(result));
  if (!parsedResult.success) return null;

  return parsedResult.data.transliteration
    .replace(/ʻ/g, "ʿ")
    .replace(/'/g, "ʾ");
};
