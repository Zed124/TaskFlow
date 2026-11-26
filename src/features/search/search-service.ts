import type { SqlExecutor } from "@/db/executor";
import { createRepositories } from "@/db/repositories";
import type { SearchHit } from "@/db/repositories/search-repository";

export function createSearchService(db: SqlExecutor) {
  const read = createRepositories(db);
  return {
    /** Global full-text search across tasks, projects, categories and notes. */
    search: (text: string, limit = 30): Promise<SearchHit[]> => read.search.search(text, limit),
  };
}

export type SearchService = ReturnType<typeof createSearchService>;
