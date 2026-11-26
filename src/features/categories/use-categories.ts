import { keys, useServiceQuery } from "@/app/data";

export function useCategories() {
  return useServiceQuery(keys.categories(), (s) => s.categories.list());
}
