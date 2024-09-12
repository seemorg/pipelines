import fs from "fs/promises";

import { removeDiacritics } from "./diacritics";

export const chunk = <T>(array: T[], size: number): T[][] => {
  return array.reduce<T[][]>((acc, _, i) => {
    if (i % size === 0) acc.push(array.slice(i, i + size));
    return acc;
  }, []);
};

export const formatTime = (time: number) => {
  const seconds = Math.floor(time / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
};

export const dedupeStrings = (names: string[]) => {
  return Array.from(new Set(names.map((n) => n.trim())));
};

export const toTitleCase = (str: string) => {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase(),
  );
};

export const getNamesVariations = (names: (string | null | undefined)[]) => {
  const newVariations: string[] = [];

  (
    names.filter((n) => n !== null && typeof n !== "undefined") as string[]
  ).forEach((name) => {
    const nameWithoutDiactrics = removeDiacritics(name);

    if (nameWithoutDiactrics !== name && !names.includes(nameWithoutDiactrics))
      newVariations.push(nameWithoutDiactrics);

    const nameWithoutSpecialChars = nameWithoutDiactrics.replace(
      /[‏.»,!?;:"'،؛؟\-_(){}\[\]<>@#\$%\^&\*\+=/\\`~]/gi,
      "",
    );

    if (
      nameWithoutSpecialChars !== nameWithoutDiactrics &&
      !names.includes(nameWithoutSpecialChars)
    )
      newVariations.push(nameWithoutSpecialChars);

    const nameWithoutAl = nameWithoutDiactrics
      .replace(/(al-)/gi, "")
      .replace(/(al )/gi, "")
      .replace(/(ال)/gi, "");

    if (
      nameWithoutAl !== nameWithoutDiactrics &&
      !names.includes(nameWithoutAl)
    )
      newVariations.push(nameWithoutAl);
  });

  return newVariations;
};

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const ensureDir = async (dir: string) => {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
};
