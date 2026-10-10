/**
 * scripts/backfillStoreMeta.js
 * ==============================
 * 기존에 이미 DB로 들어간 매장들의 다음 값을 한 번에 다시 계산해서 채운다 (새 API 호출 없음):
 *  - type(booth/studio) — lib/storeApi.js classifyStoreType로 이름 기준 재분류
 *    ("포토"/"photo" 키워드를 뺀 버전 — 일반 사진관이 booth로 오분류되던 문제 수정)
 *  - brand — type==='booth'인 매장만 lib/photoBoothBrands.js로 분류, 'studio'는 null("-")
 *  - ctprvn_name(시/도), signgu_name(시/군/구) — 로컬 CSV/전국 JSON 원본에서 bizes_id로 조회
 *
 * 실행: node scripts/backfillStoreMeta.js
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { readItemsCsv } from "../lib/csv.js";
import { pickBrandLabel } from "../lib/photoBoothBrands.js";
import { classifyStoreType } from "../lib/storeApi.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, "..", "photo_booth_stores.csv");
const NATIONWIDE_JSON_PATH = path.join(__dirname, "..", "nationwide_photo_studio_stores.json");

function loadRegionMap() {
  const map = new Map(); // bizesId -> { ctprvnNm, signguNm }

  if (fs.existsSync(CSV_PATH)) {
    for (const item of readItemsCsv(CSV_PATH)) {
      if (item.bizesId) map.set(item.bizesId, { ctprvnNm: item.ctprvnNm || null, signguNm: item.signguNm || null });
    }
  }
  if (fs.existsSync(NATIONWIDE_JSON_PATH)) {
    const items = JSON.parse(fs.readFileSync(NATIONWIDE_JSON_PATH, "utf8"));
    for (const item of items) {
      if (item.bizesId) map.set(item.bizesId, { ctprvnNm: item.ctprvnNm || null, signguNm: item.signguNm || null });
    }
  }
  return map;
}

async function main() {
  const regionMap = loadRegionMap();
  console.log(`지역명 조회용 원본 데이터 ${regionMap.size}건 로드`);

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const { rows } = await client.query("select id, bizes_id, type as old_type, name, branch_name from stores");
  console.log(`stores ${rows.length}건 대상으로 backfill 계산`);

  const ids = [];
  const types = [];
  const ctprvnNames = [];
  const signguNames = [];
  const brands = [];
  let reclassified = 0;

  for (const row of rows) {
    const apiShaped = { bizesNm: row.name, brchNm: row.branch_name };
    const type = classifyStoreType(apiShaped);
    if (type !== row.old_type) reclassified += 1;

    const region = row.bizes_id ? regionMap.get(row.bizes_id) : null;
    ids.push(row.id);
    types.push(type);
    ctprvnNames.push(region?.ctprvnNm ?? null);
    signguNames.push(region?.signguNm ?? null);
    brands.push(type === "booth" ? pickBrandLabel(apiShaped) : null);
  }

  await client.query(
    `update stores s
     set type = v.type,
         ctprvn_name = v.ctprvn_name,
         signgu_name = v.signgu_name,
         brand = v.brand
     from (
       select * from unnest($1::bigint[], $2::text[], $3::text[], $4::text[], $5::text[])
         as v(id, type, ctprvn_name, signgu_name, brand)
     ) v
     where s.id = v.id`,
    [ids, types, ctprvnNames, signguNames, brands]
  );

  console.log(`재분류(type 변경)된 매장: ${reclassified}건`);

  const typeCounts = await client.query("select type, count(*)::int as count from stores group by type");
  console.log("유형 분포:", typeCounts.rows);

  const brandCounts = await client.query(
    "select brand, count(*)::int as count from stores where type = 'booth' group by brand order by count desc"
  );
  console.log("포토부스 브랜드 분포:");
  for (const r of brandCounts.rows) console.log(` ${r.brand ?? "(null)"}: ${r.count}`);

  const regionNullCount = await client.query("select count(*)::int as count from stores where ctprvn_name is null");
  console.log(`지역명 매칭 안 된 매장(수동 추가분 등): ${regionNullCount.rows[0].count}건`);

  await client.end();
  console.log("backfill 완료");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
