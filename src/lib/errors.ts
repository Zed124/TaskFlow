/**
 * Typed application errors. Services throw these; the UI decides how to present them.
 * (Comparable to a small custom exception hierarchy in .NET.)
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    readonly issues: readonly string[] = [],
  ) {
    super(message, "validation");
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`, "not_found");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, "conflict");
  }
}

export type DbErrorCode = "constraint" | "busy" | "sqlite" | "invalid_param" | "internal" | "ipc";

export class DbError extends AppError {
  constructor(
    message: string,
    readonly dbCode: DbErrorCode,
    options?: { cause?: unknown },
  ) {
    super(message, `db_${dbCode}`, options);
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}
