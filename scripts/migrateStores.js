/**
 * scripts/migrateStores.js
 * photo_booth_stores.csv(현재 903건)를 Supabase stores 테이블로 업서트한다.
 * bizes_id 기준으로 재실행해도 안전함(on conflict do update).
 * 실행: node scripts/migrateStores.js
 */
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { readItemsCsv } from "../lib/csv.js";
import { classifyStoreType } from "../lib/storeApi.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, "..", "photo_booth_stores.csv");

async function main() {
  const items = readItemsCsv(CSV_PATH);
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  let upserted = 0;
  for (const item of items) {
    const lat = Number(item.lat);
    const lon = Number(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    await client.query(
      `insert into stores
         (bizes_id, name, branch_name, category_name, type, road_address, lot_address, lat, lon)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (bizes_id) do update set
         name = excluded.name,
         branch_name = excluded.branch_name,
         category_name = excluded.category_name,
         type = excluded.type,
         road_address = excluded.road_address,
         lot_address = excluded.lot_address,
         lat = excluded.lat,
         lon = excluded.lon,
         updated_at = now()`,
      [
        item.bizesId || null,
        item.bizesNm,
        item.brchNm || null,
        item.indsSclsNm || null,
        classifyStoreType(item),
        item.rdnmAdr || null,
        item.lnoAdr || null,
        lat,
        lon,
      ]
    );
    upserted += 1;
  }

  const { rows } = await client.query("select count(*)::int as count from stores");
  await client.end();
  console.log(`upserted ${upserted} rows, stores table now has ${rows[0].count} rows`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
