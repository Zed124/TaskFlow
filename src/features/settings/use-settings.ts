import { useCallback } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServices } from "@/app/use-services";
import type { SettingKey, Settings, SettingValue } from "@/domain/settings";

export const settingsQueryKey = ["settings"] as const;

/** All settings. Loaded before the shell renders (see boot-gate), so this never suspends in practice. */
export function useSettings(): Settings {
  const { settings } = useServices();
  return useSuspenseQuery({ queryKey: settingsQueryKey, queryFn: () => settings.getAll() }).data;
}

/**
 * Read/write one setting with an optimistic update: the UI changes immediately and is
 * rolled back if the write fails.
 */
export function useSetting<K extends SettingKey>(
  key: K,
): [SettingValue<K>, (value: SettingValue<K>) => void, { error: Error | null }] {
  const { settings } = useServices();
  const queryClient = useQueryClient();
  const value = useSettings()[key];

  const mutation = useMutation({
    mutationFn: (next: SettingValue<K>) => settings.set(key, next),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: settingsQueryKey });
      const previous = queryClient.getQueryData<Settings>(settingsQueryKey);
      if (previous)
        queryClient.setQueryData<Settings>(settingsQueryKey, { ...previous, [key]: next });
      return { previous };
    },
    onError: (_error, _next, context) => {
      if (context?.previous) queryClient.setQueryData(settingsQueryKey, context.previous);
    },
  });

  const { mutate } = mutation;
  const set = useCallback((next: SettingValue<K>) => mutate(next), [mutate]);
  return [value, set, { error: mutation.error }];
}
