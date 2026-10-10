/**
 * scripts/migrateNationwideStores.js
 * nationwide_photo_studio_stores.json(전국 사진촬영업 M11301 격자 크롤링 결과)을
 * stores 테이블에 업서트한다. bizes_id 기준이라 기존 로컬(주안) 샘플과 안전하게 공존.
 * 실행: node scripts/migrateNationwideStores.js
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { classifyStoreType } from "../lib/storeApi.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_PATH = path.join(__dirname, "..", "nationwide_photo_studio_stores.json");

async function main() {
  const items = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
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
  console.log(`upserted ${upserted} rows (nationwide), stores table now has ${rows[0].count} rows total`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
