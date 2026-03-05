import { createDb, type Database } from "@workspace/db";
import type { Env } from "../types.js";

// Create database instance from environment
export function getDb(env: Env): Database {
  return createDb(env.DATABASE_URL);
}

export type { Database };
