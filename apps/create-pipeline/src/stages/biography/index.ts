import { getLanguageByCode } from "@/lib/languages";
import { openai } from "@/lib/openai";
import { z } from "zod";

const SYSTEM_PROMPT = (language: string) =>
  `
You are an assistant that takes a JSON about a prominent historical figure as input, and generates a bio in ${language} that's between 80 and 100 words.

In the bio:
Don't include other names for the figure
Don't include general statements like "key/prominent figure"
Do not include criticisms of the authors
Do not mention his birth or death dates
Do not mention the legacy and impact that he had
You can talk about their popular works

The readers of the bio are deeply knowledgeable of Islam and History.

Sample Output:
{
  "bio": "...",
}
`.trim();

const schema = z.object({
  bio: z.string(),
});

export const generateBiography = async (
  author: {
    primaryArabicName: string;
    primaryLatinName?: string;
    otherArabicNames?: string[];
    otherLatinNames?: string[];
  },
  locale: string,
): Promise<string | null> => {
  const language = getLanguageByCode(locale);
  if (!language) return null;

  const completion = await openai.chat.completions.create({
    model: "",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT(language.name) },
      {
        role: "user",
        content: JSON.stringify(
          {
            primaryArabicName: author.primaryArabicName,
            primaryLatinName: author.primaryLatinName,
            otherArabicNames: author.otherArabicNames,
            otherLatinNames: author.otherLatinNames,
          },
          null,
          2,
        ),
      },
    ],
  });

  const result = completion.choices[0]?.message.content;
  if (!result) return null;

  const parsedResult = schema.safeParse(JSON.parse(result));
  if (!parsedResult.success) return null;

  return parsedResult.data.bio;
};

const TRANSLATE_SYSTEM_PROMPT = (sourceLocale: string, targetLocale: string) =>
  `
You are an assistant that takes a biography written in ${sourceLocale} and translates it into ${targetLocale}.

Sample Output:
{
  "bio": "...",
}
`.trim();

const translateSchema = z.object({
  bio: z.string(),
});

export const translateBiography = async (
  { text, locale: sourceLocale }: { text: string; locale: "ar" | "en" },
  locale: string,
): Promise<string | null> => {
  const language = getLanguageByCode(locale);
  if (!language) return null;

  const completion = await openai.chat.completions.create({
    model: "",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: TRANSLATE_SYSTEM_PROMPT(sourceLocale, language.name),
      },
      {
        role: "user",
        content: text,
      },
    ],
  });

  const result = completion.choices[0]?.message.content;
  if (!result) return null;

  const parsedResult = translateSchema.safeParse(JSON.parse(result));
  if (!parsedResult.success) return null;

  return parsedResult.data.bio;
};
