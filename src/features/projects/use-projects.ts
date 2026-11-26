import { keys, useServiceQuery } from "@/app/data";

export function useProjects(includeArchived = false) {
  return useServiceQuery(keys.projects(includeArchived), (s) =>
    s.projects.list({ includeArchived }),
  );
}

export function useProject(id: string) {
  return useServiceQuery(keys.project(id), (s) => s.projects.get(id));
}
