import { Database } from "@/db/executor";
import { createNodeDriver } from "@/db/drivers/node-driver";
import { migrate } from "@/db/migrator";
import { migrations } from "@/db/migrations";

/** A fresh in-memory database with all real migrations applied. */
export async function createTestDb(): Promise<Database> {
  const db = new Database(createNodeDriver());
  await migrate(db, migrations);
  return db;
}
