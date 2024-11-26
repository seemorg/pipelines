import { indexAuthors } from "src/typesense/index-authors";
import { indexBooks } from "src/typesense/index-books";
import { indexTypesenseGenres } from "src/typesense/index-genres";
import { indexTypesenseRegions } from "src/typesense/index-regions";
import { indexTypesenseSearch } from "src/typesense/index-search";

export const reIndexTypesense = async () => {
  // Index everything
  await indexAuthors();
  await indexBooks();
  await indexTypesenseGenres();
  await indexTypesenseRegions();
  await indexTypesenseSearch();

  return {
    success: true,
    completedAt: Date.now(),
  };
};
