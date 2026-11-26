import { v7 as uuidv7 } from "uuid";

/** Time-ordered UUIDv7: unique across devices (sync-ready) and index-friendly. */
export function newId(): string {
  return uuidv7();
}
