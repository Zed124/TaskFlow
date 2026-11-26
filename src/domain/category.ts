import { z } from "zod";
import type { IsoInstant } from "@/lib/time";
import { ENTITY_COLOR_NAMES, type EntityColor } from "./colors";

export interface Category {
  id: string;
  name: string;
  color: EntityColor | null;
  sortOrder: number;
  archivedAt: IsoInstant | null;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
  deletedAt: IsoInstant | null;
}

export interface CategoryWithCount extends Category {
  openTaskCount: number;
  taskCount: number;
}

const name = z.string().trim().min(1, "Name is required").max(100, "Name is too long");
const color = z.enum(ENTITY_COLOR_NAMES as [EntityColor, ...EntityColor[]]).nullable();

export const createCategorySchema = z.object({ name, color: color.default("slate") });
export type CreateCategoryInput = z.input<typeof createCategorySchema>;

export const updateCategorySchema = z.object({ name, color }).partial();
export type UpdateCategoryPatch = z.input<typeof updateCategorySchema>;
