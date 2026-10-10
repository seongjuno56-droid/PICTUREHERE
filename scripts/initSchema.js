/**
 * scripts/initSchema.js
 * db/schema.sql을 DATABASE_URL이 가리키는 Supabase Postgres에 적용한다.
 * 실행: node scripts/initSchema.js
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log("schema applied");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
