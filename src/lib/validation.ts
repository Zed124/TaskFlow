import type { z } from "zod";
import { ValidationError } from "./errors";

/** Parses with a Zod schema and converts failures into a ValidationError with readable messages. */
export function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const issues = result.error.issues.map((i) => i.message);
  throw new ValidationError(issues[0] ?? "Invalid input", issues);
}
