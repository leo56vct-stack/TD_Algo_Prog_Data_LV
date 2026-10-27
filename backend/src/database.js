import { readFile } from "node:fs/promises";
import pg from "pg";

const { Pool } = pg;

export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL must be configured.");
  }
  return new Pool({ connectionString });
}

export async function initializeDatabase(pool) {
  const schema = await readFile(new URL("../database/schema.sql", import.meta.url), "utf8");
  await pool.query(schema);
}