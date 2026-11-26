import { parseMigrations } from "../migrator";

// Vite inlines every .sql file in this folder as a string at build time (works in Vitest too).
const files = import.meta.glob<string>("./*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
});

export const migrations = parseMigrations(files);
