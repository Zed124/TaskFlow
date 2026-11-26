import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseQueryResult,
} from "@tanstack/react-query";
import { errorMessage } from "@/lib/errors";
import type { Services } from "./services";
import { toast } from "./toast-store";
import { useServices } from "./use-services";

/**
 * Query keys. Every key starts with a data area, so a write can invalidate broadly
 * (local SQLite reads are cheap; correctness beats cleverness here).
 */
export const keys = {
  tasks: (filter: unknown) => ["tasks", filter] as const,
  task: (id: string) => ["task", id] as const,
  taskActivity: (id: string) => ["activity", "task", id] as const,
  projectActivity: (id: string) => ["activity", "project", id] as const,
  feed: (source: string) => ["activity", "feed", source] as const,
  projects: (includeArchived: boolean) => ["projects", includeArchived] as const,
  project: (id: string) => ["project", id] as const,
  categories: () => ["categories"] as const,
  search: (text: string) => ["search", text] as const,
};

/** Reads through a service. Keeps the previous result while a new key loads (no list flicker). */
export function useServiceQuery<T>(
  key: QueryKey,
  read: (services: Services) => Promise<T>,
  options: { enabled?: boolean } = {},
): UseQueryResult<T> {
  const services = useServices();
  return useQuery({
    queryKey: key,
    queryFn: () => read(services),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

/** Refreshes every data query (everything except settings) after a write. */
export function useInvalidateData() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "settings" });
}

/**
 * Writes through a service. On success, all data queries refresh; on failure the error is
 * shown as a toast (and re-thrown to `mutateAsync` callers that want to react).
 */
export function useServiceMutation<TVars, TData>(
  write: (services: Services, vars: TVars) => Promise<TData>,
  options: { onSuccess?: (data: TData, vars: TVars) => void; silentErrors?: boolean } = {},
) {
  const services = useServices();
  const invalidate = useInvalidateData();
  return useMutation({
    mutationFn: (vars: TVars) => write(services, vars),
    onSuccess: async (data, vars) => {
      await invalidate();
      options.onSuccess?.(data, vars);
    },
    onError: (error) => {
      if (!options.silentErrors) toast.error(errorMessage(error));
    },
  });
}
