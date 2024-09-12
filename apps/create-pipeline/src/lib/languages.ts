export const languages = [
  {
    code: "ar",
    name: "Arabic",
  },
  {
    code: "en",
    name: "English",
  },
  {
    code: "fa",
    name: "Persian",
  },
  {
    code: "ur",
    name: "Urdu",
  },
  {
    code: "hi",
    name: "Hindi",
  },
  {
    code: "fr",
    name: "French",
  },
  {
    code: "tr",
    name: "Turkish",
  },
  {
    code: "es",
    name: "Spanish",
  },
  {
    code: "ms",
    name: "Malay",
  },
  {
    code: "ru",
    name: "Russian",
  },
  {
    code: "bn",
    name: "Bengali",
  },
  {
    code: "ha",
    name: "Hausa",
  },
  {
    code: "so",
    name: "Somali",
  },
  {
    code: "ps",
    name: "Pashto",
  },
];

export const languagesWithoutEnglish = languages.filter(
  (language) => language.code !== "en",
);
export const languagesWithoutArabic = languages.filter(
  (language) => language.code !== "ar",
);

export const getLanguageByCode = (code: string) => {
  return languages.find((language) => language.code === code);
};
