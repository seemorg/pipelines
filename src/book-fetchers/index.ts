import type { OpenitiBookResponse } from "./openiti";
import type { TurathBookResponse } from "./turath";
import { fetchOpenitiBook } from "./openiti";
import { fetchTurathBook } from "./turath";
import _uploadedVersions from "./uploaded-versions.json";

const uploadedVersions = _uploadedVersions as Record<string, boolean>;

export type ExternalBookResponse = {
  source: "external";
  versionId: string;
};

export type OcrBookResponse = {
  id: string;
  source: "pdf";
  publicationDetails: PrismaJson.BookVersion["publicationDetails"];
  url: string;
  pages: {
    volume: number | null;
    page: number | null;
    content: string | null;
    footnotes: string | null;
    editorialNotes: string | null;
  }[];
  headings: {
    title: string;
    level: number;
    page: {
      volume: number | null;
      page: number | null;
    };
    pageIndex: number;
  }[];
};

export type FetchBookResponse =
  | TurathBookResponse
  | OpenitiBookResponse
  | ExternalBookResponse
  | OcrBookResponse;

export type FetchBookResponseOfType<T extends FetchBookResponse["source"]> =
  Extract<FetchBookResponse, { source: T }>;

export const fetchBookContent = async (
  record: {
    versions: PrismaJson.BookVersion[];
    id: string;
    author: { id: string };
  },
  versionId?: string,
): Promise<FetchBookResponse | null> => {
  const allVersions = record.versions;

  let version: PrismaJson.BookVersion | undefined;
  if (versionId) {
    version = allVersions.find((v) => v.value === versionId);
  }

  if (!version) {
    // if the first 2 versions are turath, use the 2nd one
    // otherwise, just use the first version
    if (
      allVersions[0]?.source === "turath" &&
      allVersions[1]?.source === "turath"
    ) {
      version = allVersions[1];
    } else {
      version = allVersions[0];
    }
  }

  if (!version) {
    return null;
  }

  const baseResponse = {
    source: version.source,
    versionId: version.value,
  };

  if (version.source === "external") {
    return {
      ...baseResponse,
    } as FetchBookResponse;
  }

  if (version.source === "turath") {
    const turathBook = await fetchTurathBook(version.value);
    return {
      ...baseResponse,
      ...turathBook,
    } as TurathBookResponse;
  }

  if (version.source === "pdf" && version.ocrBookId) {
    const key = `book-content/ocr/${version.ocrBookId}.json`;
    if (uploadedVersions[key]) {
      const ocrBook = await (
        await fetch(`https://assets.usul.ai/${key}`)
      ).json();
      return {
        ...baseResponse,
        url: version.value,
        ...(ocrBook as any),
      } as FetchBookResponse;
    }

    return { ...baseResponse, url: version.value } as FetchBookResponse;
  }

  const openitiBook = await fetchOpenitiBook({
    authorId: record.author!.id,
    bookId: record.id,
    versionId: version.value,
  }).catch(() => null);

  if (!openitiBook) {
    return null;
  }

  return {
    ...baseResponse,
    ...openitiBook,
  } as FetchBookResponse;
};
