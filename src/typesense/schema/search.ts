import type { CollectionCreateSchema } from "typesense/lib/Typesense/Collections";
import { dedupeStrings, getNamesVariations } from "@/utils";

import { prepareTypesenseAuthorsData } from "./author";
import { prepareTypesenseBooksData } from "./book";
import { prepareTypesenseRegionsData } from "./region";
import { prepareTypesenseEmpiresData } from "./empire";
import { prepareTypesenseAdvancedGenresData } from "./advancedGenre";

export const COLLECTION_NAME = "all_documents";
export const BATCH_SIZE = 100;

export const TYPESENSE_SEARCH_SCHEMA = (
  indexName: string,
): CollectionCreateSchema => ({
  name: indexName,
  enable_nested_fields: true,
  fields: [
    {
      name: "type",
      type: "string",
      facet: true,
    },
    {
      name: "id",
      type: "string",
    },
    {
      name: "slug",
      type: "string",
    },
    {
      name: "year",
      type: "int32",
      optional: true,
    },
    {
      name: "transliteration",
      type: "string",
      optional: true,
    },
    {
      name: "primaryNames",
      type: "object[]",
      optional: true,
    },
    {
      name: "otherNames",
      type: "object[]",
      optional: true,
    },
    {
      // this is an internal field that we'll use to search for name variations
      name: "_nameVariations",
      type: "string[]",
      optional: true,
    },
    {
      name: "_popularity",
      type: "int32",
      optional: true,
    },
    {
      name: "_rank",
      type: "int32",
      optional: true,
    },
    {
      name: "author",
      type: "object",
      optional: true,
    },
    {
      name: "booksCount",
      type: "int32",
      optional: true,
    },
  ],
});

const types = [
  "author",
  "book",
  "advanced-genre",
  "region",
  "empire",
] as const;
type SearchDocumentType = (typeof types)[number];

export interface SearchDocument {
  id: string;
  type: SearchDocumentType;
  slug: string;
  transliteration?: string;
  year?: number;
  primaryNames?: {
    text: string;
    locale: string;
  }[];
  otherNames?: {
    texts: string[];
    locale: string;
  }[];
  _nameVariations?: string[];
  _popularity?: number;
  _rank?: number;
  author?: {
    id: string;
    slug: string;
    transliteration?: string;
    year?: number;
    primaryNames?: {
      text: string;
      locale: string;
    }[];
    otherNames?: {
      texts: string[];
      locale: string;
    }[];
    _nameVariations?: string[];
  };
  booksCount?: number;
}

const getRankByType = (type: SearchDocumentType) => {
  if (type === "region") return 1;
  if (type === "empire") return 2;
  if (type === "advanced-genre") return 3;
  if (type === "author") return 4;

  // book
  return 5;
};

export const prepareTypesenseSearchDocuments = async () => {
  const documents: SearchDocument[] = [];

  for (const type of types) {
    let iterationDocuments: SearchDocument[] = [];

    if (type === "author") {
      const data = await prepareTypesenseAuthorsData();
      iterationDocuments = data.map((authorDocument): SearchDocument => {
        return {
          type: "author",
          id: authorDocument.id,
          slug: authorDocument.slug,
          year: authorDocument.year,
          transliteration: authorDocument.transliteration,
          primaryNames: authorDocument.primaryNames,
          otherNames: authorDocument.otherNames,
          booksCount: authorDocument.booksCount,
          _nameVariations: authorDocument._nameVariations,
          _popularity: authorDocument._popularity,
          _rank: getRankByType(type),
        };
      });
    }

    if (type === "book") {
      const data = await prepareTypesenseBooksData();
      iterationDocuments = data.map((bookDocument): SearchDocument => {
        return {
          type: "book",
          id: bookDocument.id,
          slug: bookDocument.slug,
          year: bookDocument.year,
          transliteration: bookDocument.transliteration,
          primaryNames: bookDocument.primaryNames,
          otherNames: bookDocument.otherNames,
          _nameVariations: bookDocument._nameVariations,
          _popularity: bookDocument._popularity,
          _rank: getRankByType(type),
          author: {
            id: bookDocument.author.id,
            slug: bookDocument.author.slug,
            year: bookDocument.author.year,
            primaryNames: bookDocument.author.primaryNames,
            otherNames: bookDocument.author.otherNames,
            _nameVariations: bookDocument.author._nameVariations,
          },
        };
      });
    }

    if (type === "region") {
      const data = await prepareTypesenseRegionsData();

      if (!Array.isArray(data)) {
        console.warn("prepareTypesenseRegionsData did not return an array");
        iterationDocuments = [];
      } else {
        iterationDocuments = data
          .filter(
            (regionDocument) =>
              regionDocument != null &&
              regionDocument.id != null &&
              regionDocument.slug != null &&
              Array.isArray(regionDocument.names),
          )
          .map((regionDocument): SearchDocument => {
            return {
              type: "region",
              id: regionDocument.id,
              slug: regionDocument.slug,
              transliteration: regionDocument.transliteration,
              primaryNames: regionDocument.names,
              booksCount: regionDocument.booksCount ?? 0,
              _nameVariations: dedupeStrings(
                getNamesVariations([
                  ...regionDocument.names.map((n) => n.text),
                ]),
              ),
              _popularity: regionDocument._popularity ?? 0,
              _rank: getRankByType(type),
            };
          });
      }
    }

    if (type === "empire") {
      const data = await prepareTypesenseEmpiresData();
      iterationDocuments = data.map((empireDocument): SearchDocument => {
        return {
          type: "empire",
          id: empireDocument.id,
          slug: empireDocument.slug,
          primaryNames: empireDocument.names,
          booksCount: empireDocument.booksCount,
          _nameVariations: dedupeStrings(
            getNamesVariations([
              ...empireDocument.names.map((n) => n.text),
            ]),
          ),
          _popularity: empireDocument._popularity,
          _rank: getRankByType(type),
        };
      });
    }

    if (type === "advanced-genre") {
      const data = await prepareTypesenseAdvancedGenresData();
      iterationDocuments = data.map(
        (advancedGenreDocument): SearchDocument => {
          return {
            type: "advanced-genre",
            id: advancedGenreDocument.id,
            slug: advancedGenreDocument.slug,
            transliteration: advancedGenreDocument.transliteration ?? undefined,
            primaryNames: advancedGenreDocument.nameTranslations,
            booksCount: advancedGenreDocument.booksCount,
            _popularity: advancedGenreDocument._popularity,
            _rank: getRankByType(type),
          };
        },
      );
    }

    documents.push(...iterationDocuments);
  }

  return documents;
};
