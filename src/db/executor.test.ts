import { describe, expect, it } from "vitest";
import { Database } from "./executor";
import { createNodeDriver } from "./drivers/node-driver";
import { DbError } from "@/lib/errors";

async function freshDb() {
  const db = new Database(createNodeDriver());
  await db.executeBatch("CREATE TABLE t (id TEXT PRIMARY KEY, n INTEGER NOT NULL)");
  return db;
}

describe("Database", () => {
  it("commits a transaction", async () => {
    const db = await freshDb();
    await db.transaction(async (tx) => {
      await tx.execute("INSERT INTO t VALUES (?, ?)", ["a", 1]);
      await tx.execute("INSERT INTO t VALUES (?, ?)", ["b", 2]);
    });
    expect(await db.select("SELECT * FROM t")).toHaveLength(2);
  });

  it("rolls back every statement when the work throws", async () => {
    const db = await freshDb();
    await expect(
      db.transaction(async (tx) => {
        await tx.execute("INSERT INTO t VALUES (?, ?)", ["a", 1]);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await db.select("SELECT * FROM t")).toHaveLength(0);
  });

  it("rolls back on a constraint failure and surfaces a DbError", async () => {
    const db = await freshDb();
    const attempt = db.transaction(async (tx) => {
      await tx.execute("INSERT INTO t VALUES (?, ?)", ["a", 1]);
      await tx.execute("INSERT INTO t VALUES (?, ?)", ["a", 2]);
    });
    await expect(attempt).rejects.toBeInstanceOf(DbError);
    await expect(attempt).rejects.toMatchObject({ dbCode: "constraint" });
    expect(await db.select("SELECT * FROM t")).toHaveLength(0);
  });

  it("joins nested transactions into the outer one", async () => {
    const db = await freshDb();
    await expect(
      db.transaction(async (tx) => {
        await tx.transaction((inner) => inner.execute("INSERT INTO t VALUES (?, ?)", ["a", 1]));
        throw new Error("outer fails");
      }),
    ).rejects.toThrow();
    expect(await db.select("SELECT * FROM t")).toHaveLength(0);
  });

  it("does not let concurrent queries run inside another caller's transaction", async () => {
    const db = await freshDb();
    let releaseTx!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseTx = resolve;
    });

    const tx = db
      .transaction(async (t) => {
        await t.execute("INSERT INTO t VALUES (?, ?)", ["in-tx", 1]);
        await gate;
        throw new Error("rollback");
      })
      .catch(() => undefined);

    // Issued while the transaction is open; must wait and must not be rolled back with it.
    const outside = db.execute("INSERT INTO t VALUES (?, ?)", ["outside", 2]);
    releaseTx();
    await Promise.all([tx, outside]);

    const rows = await db.select<{ id: string }>("SELECT id FROM t");
    expect(rows.map((r) => r.id)).toEqual(["outside"]);
  });

  it("binds booleans as integers", async () => {
    const db = await freshDb();
    await db.execute("INSERT INTO t VALUES (?, ?)", ["a", true]);
    expect(await db.select("SELECT n FROM t")).toEqual([{ n: 1 }]);
  });
});
