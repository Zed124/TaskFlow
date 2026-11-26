import { Mutex } from "@/lib/mutex";

/** Values that can be bound as SQL parameters. Booleans are stored as 0/1. */
export type SqlValue = string | number | boolean | null;

export interface ExecResult {
  changes: number;
  lastInsertRowid: number;
}

/** A raw result row. Repositories are responsible for mapping rows to domain types. */
export type SqlRow = Record<string, unknown>;

/**
 * Low-level driver: one connection, no concurrency control.
 * Implementations: Tauri IPC (app) and node:sqlite (tests).
 */
export interface SqlDriver {
  execute(sql: string, params: readonly SqlValue[]): Promise<ExecResult>;
  select(sql: string, params: readonly SqlValue[]): Promise<SqlRow[]>;
  /** Runs a parameterless multi-statement script (migrations). */
  executeBatch(sql: string): Promise<void>;
}

/** What repositories and services depend on. */
export interface SqlExecutor {
  execute(sql: string, params?: readonly SqlValue[]): Promise<ExecResult>;
  /**
   * `T` describes the expected row shape. It is not checked at runtime; repositories should
   * only use it with rows they define, and must validate anything that came from outside.
   */
  select<T extends SqlRow = SqlRow>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  executeBatch(sql: string): Promise<void>;
  /** Runs `work` atomically. Nested calls on the transaction executor join the outer transaction. */
  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}

function normalize(params: readonly SqlValue[]): SqlValue[] {
  return params.map((p) => (typeof p === "boolean" ? (p ? 1 : 0) : p));
}

/**
 * Serializes all access to a single-connection driver.
 *
 * Why: a transaction is a sequence of separate async calls (BEGIN … COMMIT). Without the
 * mutex, an unrelated query issued meanwhile would run *inside* that transaction.
 */
export class Database implements SqlExecutor {
  private readonly lock = new Mutex();

  constructor(private readonly driver: SqlDriver) {}

  execute(sql: string, params: readonly SqlValue[] = []): Promise<ExecResult> {
    return this.lock.run(() => this.driver.execute(sql, normalize(params)));
  }

  select<T extends SqlRow = SqlRow>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
    return this.lock.run(() => this.driver.select(sql, normalize(params))) as Promise<T[]>;
  }

  executeBatch(sql: string): Promise<void> {
    return this.lock.run(() => this.driver.executeBatch(sql));
  }

  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    return this.lock.run(async () => {
      await this.driver.executeBatch("BEGIN IMMEDIATE");
      try {
        const result = await work(new TransactionExecutor(this.driver));
        await this.driver.executeBatch("COMMIT");
        return result;
      } catch (error) {
        try {
          await this.driver.executeBatch("ROLLBACK");
        } catch {
          // The original error is more useful than a rollback failure.
        }
        throw error;
      }
    });
  }
}

/** Executor handed to transaction callbacks; it already holds the lock. */
class TransactionExecutor implements SqlExecutor {
  constructor(private readonly driver: SqlDriver) {}

  execute(sql: string, params: readonly SqlValue[] = []): Promise<ExecResult> {
    return this.driver.execute(sql, normalize(params));
  }

  select<T extends SqlRow = SqlRow>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
    return this.driver.select(sql, normalize(params)) as Promise<T[]>;
  }

  executeBatch(sql: string): Promise<void> {
    return this.driver.executeBatch(sql);
  }

  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    return work(this);
  }
}
