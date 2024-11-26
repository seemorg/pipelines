import { indexAuthors } from "@/typesense/index-authors";
import { indexBooks } from "@/typesense/index-books";
import { indexTypesenseGenres } from "@/typesense/index-genres";
import { indexTypesenseRegions } from "@/typesense/index-regions";
import { indexTypesenseSearch } from "@/typesense/index-search";

const reIndexTypesense = async () => {
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

export default reIndexTypesense;
