import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import "dotenv/config";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const sqlFilePath = resolve("database", "init.sql");
const sql = await readFile(sqlFilePath, "utf8");

async function connectToDatabase(): Promise<pg.Client> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const client = new pg.Client({
      connectionString: databaseUrl,
    });

    try {
      await client.connect();
      return client;
    } catch (error) {
      lastError = error;
      await client.end().catch(() => undefined);
      await setTimeout(1000);
    }
  }

  throw lastError;
}

const client = await connectToDatabase();

try {
  await client.query(sql);
  console.log("Database initialized");
} finally {
  await client.end();
}
