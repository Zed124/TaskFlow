import { z } from "zod";
import type { IsoInstant } from "@/lib/time";
import { ENTITY_COLOR_NAMES, type EntityColor } from "./colors";

export interface Project {
  id: string;
  name: string;
  description: string;
  color: EntityColor | null;
  sortOrder: number;
  archivedAt: IsoInstant | null;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
  deletedAt: IsoInstant | null;
}

/** Progress derived from the project's top-level tasks. Cancelled tasks don't count toward the total. */
export interface ProjectProgress {
  total: number;
  completed: number;
  inProgress: number;
  open: number;
  cancelled: number;
}

export interface ProjectWithProgress extends Project {
  progress: ProjectProgress;
}

export function progressRatio(p: ProjectProgress): number {
  return p.total === 0 ? 0 : p.completed / p.total;
}

const name = z.string().trim().min(1, "Name is required").max(200, "Name is too long");
const color = z.enum(ENTITY_COLOR_NAMES as [EntityColor, ...EntityColor[]]).nullable();

export const createProjectSchema = z.object({
  name,
  description: z.string().max(10_000).default(""),
  color: color.default("violet"),
});
export type CreateProjectInput = z.input<typeof createProjectSchema>;

export const updateProjectSchema = z
  .object({ name, description: z.string().max(10_000), color })
  .partial();
export type UpdateProjectPatch = z.input<typeof updateProjectSchema>;
