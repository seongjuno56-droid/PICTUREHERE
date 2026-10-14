/**
 * scripts/syncStores.js
 * =======================
 * 정기 데이터 갱신 — 전국 사진촬영업(M11301) 매장을 새로 수집해서 stores 테이블에 반영한다.
 * 예전엔 fetchNationwidePhotoStores → migrateNationwideStores → backfillStoreMeta 세 단계를
 * 손으로 돌렸는데, 이걸 한 번에 처리한다(GitHub Actions .github/workflows/sync-stores.yml에서 실행).
 *
 * 처리 순서
 *  1. 전국 격자 수집 — 실패한 격자 포인트는 몇 번 더 재시도한다.
 *  2. 안전 점검 — 끝내 실패한 포인트가 남았거나 수집 건수가 지금 DB보다 크게 줄었으면
 *     DB는 건드리지 않고 실패로 끝낸다(반쪽짜리 수집으로 멀쩡한 매장을 지우는 사고 방지).
 *  3. 업서트 — 신규 매장 추가, 기존 매장 갱신(type/brand/시도/시군구까지 한 번에 계산).
 *     어드민에서 직접 고친 매장(admin_edited_at 있음)은 내용을 덮어쓰지 않고 last_seen_at만 갱신.
 *  4. 폐업 추정 — 이번 수집에 안 잡힌 매장은 is_active=false, closed_at=now().
 *     대상은 공공데이터에서 들어온 매장(bizes_id 있음) 중 이번 수집과 같은 업종명인 것만.
 *     어드민에서 직접 추가/수정한 매장은 대상이 아니다. 다음 수집에 다시 잡히면 자동 복구.
 *
 * 실행: node scripts/syncStores.js            (DB 반영)
 *       node scripts/syncStores.js --dry-run  (수집·집계만 하고 DB 변경은 롤백)
 * 필요한 환경변수: DATA_GO_KR_SERVICE_KEY, DATABASE_URL
 */
import "dotenv/config";
import fs from "node:fs";
import { Client } from "pg";
import { fetchAllStores, classifyStoreType, PHOTO_STUDIO_INDS_SCLS_CD } from "../lib/storeApi.js";
import { pickBrandLabel } from "../lib/photoBoothBrands.js";
import { buildNationwideGrid, NATIONWIDE_RADIUS_M } from "../lib/nationwideGrid.js";

const DRY_RUN = process.argv.includes("--dry-run");

const RETRY_ROUNDS = 3; // 1차 수집 후 실패한 포인트만 다시 도는 횟수
const CALL_INTERVAL_MS = 150; // 공공데이터포털에 과도한 연속 호출을 피하기 위한 최소 간격
const MAX_CONSECUTIVE_FAILURES = 15; // 이만큼 연속 실패하면 키/네트워크 문제로 보고 즉시 중단
// 이번 수집 건수가 지금 DB의 공공데이터 매장 수보다 이 비율 이상 줄었으면 수집 이상으로 보고 중단
const MAX_SHRINK_RATIO = 0.2;
// 폐업 추정으로 한 번에 비활성화하는 매장이 활성 매장의 이 비율을 넘으면 비활성화 단계만 건너뜀
const MAX_DEACTIVATE_RATIO = 0.15;
const UPSERT_CHUNK = 500;

// 키 미등록/만료/트래픽 초과 등 — 재시도해도 소용없는 오류라 바로 중단한다.
// (공공데이터포털은 이런 경우 JSON 대신 XML 오류를 돌려주기도 해서 그 메시지도 포함)
const FATAL_ERROR_PATTERN = /resultCode=(20|22|30|31|32)\b|JSON이 아닙니다/;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

/** GitHub Actions 실행 화면의 Summary 탭에 결과 표를 남긴다(로컬 실행 땐 무시). */
function writeJobSummary(markdown) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) fs.appendFileSync(file, `${markdown}\n`);
}

async function crawl(serviceKey) {
  const grid = buildNationwideGrid();
  const itemsById = new Map();
  let pending = grid.map((_, i) => i);
  let callCount = 0;
  const startedAt = Date.now();

  log(`전국 격자 ${grid.length}개 포인트 수집 시작`);

  for (let round = 0; round <= RETRY_ROUNDS && pending.length > 0; round += 1) {
    if (round > 0) {
      log(`실패한 ${pending.length}개 포인트 재시도 (${round}/${RETRY_ROUNDS})`);
      await sleep(5000 * round);
    }

    const failed = [];
    let consecutiveFailures = 0;

    for (let n = 0; n < pending.length; n += 1) {
      const i = pending[n];
      const { cx, cy } = grid[i];
      try {
        const items = await fetchAllStores({
          serviceKey,
          cx,
          cy,
          radius: NATIONWIDE_RADIUS_M,
          indsSclsCd: PHOTO_STUDIO_INDS_SCLS_CD,
          onProgress: () => {
            callCount += 1;
          },
        });
        for (const item of items) {
          if (item.bizesId) itemsById.set(item.bizesId, item);
        }
        consecutiveFailures = 0;
      } catch (err) {
        if (FATAL_ERROR_PATTERN.test(err.message)) {
          throw new Error(`공공데이터 API가 요청을 거부했습니다 (서비스키/트래픽 한도 확인 필요): ${err.message}`);
        }
        consecutiveFailures += 1;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          throw new Error(`${MAX_CONSECUTIVE_FAILURES}회 연속 실패 — 네트워크나 API 상태를 확인하세요. 마지막 오류: ${err.message}`);
        }
        console.error(`  포인트 #${i} (cx=${cx}, cy=${cy}) 실패: ${err.message}`);
        failed.push(i);
        await sleep(500);
        continue;
      }

      if ((n + 1) % 100 === 0) {
        const elapsedMin = ((Date.now() - startedAt) / 60000).toFixed(1);
        log(`  ${n + 1}/${pending.length} · 누적 매장 ${itemsById.size}건 · API 호출 ${callCount}회 · ${elapsedMin}분`);
      }
      await sleep(CALL_INTERVAL_MS);
    }

    pending = failed;
  }

  const elapsedMin = ((Date.now() - startedAt) / 60000).toFixed(1);
  log(`수집 종료: 매장 ${itemsById.size}건, API 호출 ${callCount}회, ${elapsedMin}분, 최종 실패 포인트 ${pending.length}개`);
  return { items: Array.from(itemsById.values()), failedPoints: pending.length, gridSize: grid.length, callCount };
}

/** API 응답 아이템 → stores 테이블 한 행 */
function toRow(item) {
  const lat = Number(item.lat);
  const lon = Number(item.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const type = classifyStoreType(item);
  return {
    bizesId: item.bizesId,
    name: item.bizesNm,
    branchName: item.brchNm || null,
    categoryName: item.indsSclsNm || null,
    type,
    brand: type === "booth" ? pickBrandLabel(item) : null,
    ctprvnName: item.ctprvnNm || null,
    signguName: item.signguNm || null,
    roadAddress: item.rdnmAdr || null,
    lotAddress: item.lnoAdr || null,
    lat,
    lon,
  };
}

async function applyToDatabase(client, rows, runStartedAt) {
  const result = { inserted: 0, updated: 0, reactivated: 0, adminProtected: 0, deactivated: 0, deactivationSkipped: null };

  // 어드민에서 직접 고친 매장은 내용은 그대로 두고 "이번에도 수집됐다"는 표시만 남긴다.
  const protectedRes = await client.query(
    `update stores set last_seen_at = $2
     where bizes_id = any($1::text[]) and admin_edited_at is not null`,
    [rows.map((r) => r.bizesId), runStartedAt]
  );
  result.adminProtected = protectedRes.rowCount;

  // 지난번에 폐업 추정으로 내렸는데 이번에 다시 잡힌 매장(아래 업서트에서 자동 복구됨)
  const reactivatedRes = await client.query(
    `select count(*)::int as count from stores
     where bizes_id = any($1::text[]) and closed_at is not null and admin_edited_at is null`,
    [rows.map((r) => r.bizesId)]
  );
  result.reactivated = reactivatedRes.rows[0].count;

  for (let start = 0; start < rows.length; start += UPSERT_CHUNK) {
    const chunk = rows.slice(start, start + UPSERT_CHUNK);
    const col = (key) => chunk.map((r) => r[key]);
    const { rows: changed } = await client.query(
      `insert into stores
         (bizes_id, name, branch_name, category_name, type, brand, ctprvn_name, signgu_name,
          road_address, lot_address, lat, lon, last_seen_at)
       select v.*, $13::timestamptz
       from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[],
                   $8::text[], $9::text[], $10::text[], $11::float8[], $12::float8[])
         as v(bizes_id, name, branch_name, category_name, type, brand, ctprvn_name, signgu_name,
              road_address, lot_address, lat, lon)
       on conflict (bizes_id) do update set
         name = excluded.name,
         branch_name = excluded.branch_name,
         category_name = excluded.category_name,
         type = excluded.type,
         brand = excluded.brand,
         ctprvn_name = excluded.ctprvn_name,
         signgu_name = excluded.signgu_name,
         road_address = excluded.road_address,
         lot_address = excluded.lot_address,
         lat = excluded.lat,
         lon = excluded.lon,
         last_seen_at = excluded.last_seen_at,
         -- sync가 폐업 추정으로 내렸던 매장이 다시 잡히면 복구(어드민이 직접 내린 건 closed_at이 없어 그대로)
         is_active = case when stores.closed_at is not null then true else stores.is_active end,
         closed_at = null,
         updated_at = now()
       where stores.admin_edited_at is null
       returning (xmax = 0) as inserted`,
      [
        col("bizesId"),
        col("name"),
        col("branchName"),
        col("categoryName"),
        col("type"),
        col("brand"),
        col("ctprvnName"),
        col("signguName"),
        col("roadAddress"),
        col("lotAddress"),
        col("lat"),
        col("lon"),
        runStartedAt,
      ]
    );
    for (const row of changed) {
      if (row.inserted) result.inserted += 1;
      else result.updated += 1;
    }
  }

  return result;
}

async function main() {
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey) throw new Error("DATA_GO_KR_SERVICE_KEY 환경변수가 없습니다.");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL 환경변수가 없습니다.");

  log(DRY_RUN ? "DRY RUN — 수집·집계만 하고 DB 변경은 저장하지 않습니다." : "데이터 갱신 시작");

  const crawlResult = await crawl(serviceKey);
  const rows = crawlResult.items.map(toRow).filter(Boolean);

  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const { rows: before } = await client.query(
      `select count(*) filter (where bizes_id is not null)::int as public_total,
              count(*) filter (where bizes_id is not null and is_active)::int as public_active
       from stores`
    );
    const publicActiveBefore = before[0].public_active;

    // --- 안전 점검: 반쪽짜리 수집이면 DB를 건드리지 않는다 ---
    if (crawlResult.failedPoints > 0) {
      throw new Error(
        `재시도 후에도 ${crawlResult.failedPoints}개 격자 포인트 수집에 실패해서 DB 반영을 중단합니다. 잠시 후 다시 실행해주세요.`
      );
    }
    if (publicActiveBefore > 0 && rows.length < publicActiveBefore * (1 - MAX_SHRINK_RATIO)) {
      throw new Error(
        `수집 건수(${rows.length})가 현재 활성 매장(${publicActiveBefore})보다 ${Math.round(MAX_SHRINK_RATIO * 100)}% 넘게 적어서 DB 반영을 중단합니다. API 응답을 확인해주세요.`
      );
    }

    const runStartedAt = new Date();
    await client.query("begin");

    const result = await applyToDatabase(client, rows, runStartedAt);

    // --- 폐업 추정: 이번 수집에 안 잡힌 공공데이터 매장 비활성화 ---
    // 같은 업종명(이번 수집에 등장한 indsSclsNm)인 매장만 — 예전 로컬 샘플 중 업종코드가 달라
    // 이번 수집 범위 밖인 매장까지 폐업으로 잘못 처리하지 않도록.
    const categoryNames = [...new Set(rows.map((r) => r.categoryName).filter(Boolean))];
    const staleWhere = `is_active and bizes_id is not null and admin_edited_at is null
                        and (last_seen_at is null or last_seen_at < $1)
                        and category_name = any($2::text[])`;
    const { rows: staleCount } = await client.query(`select count(*)::int as count from stores where ${staleWhere}`, [
      runStartedAt,
      categoryNames,
    ]);
    const toDeactivate = staleCount[0].count;

    if (publicActiveBefore > 0 && toDeactivate > publicActiveBefore * MAX_DEACTIVATE_RATIO) {
      result.deactivationSkipped = `폐업 추정 ${toDeactivate}건이 활성 매장의 ${Math.round(MAX_DEACTIVATE_RATIO * 100)}%를 넘어 비활성화를 건너뜀 — 데이터를 확인해주세요`;
      log(result.deactivationSkipped);
    } else {
      const deactivated = await client.query(
        `update stores set is_active = false, closed_at = now(), updated_at = now() where ${staleWhere}`,
        [runStartedAt, categoryNames]
      );
      result.deactivated = deactivated.rowCount;
    }

    const { rows: after } = await client.query(
      "select count(*) filter (where is_active)::int as active, count(*)::int as total from stores"
    );

    if (DRY_RUN) {
      await client.query("rollback");
    } else {
      await client.query("commit");
    }

    const lines = [
      `## 매장 데이터 갱신 ${DRY_RUN ? "(DRY RUN — 저장 안 됨)" : "완료"}`,
      "",
      "| 항목 | 건수 |",
      "| --- | ---: |",
      `| 수집한 매장 | ${rows.length.toLocaleString()} |`,
      `| 신규 추가 | ${result.inserted.toLocaleString()} |`,
      `| 정보 갱신 | ${result.updated.toLocaleString()} |`,
      `| 어드민 수정분 보호(덮어쓰지 않음) | ${result.adminProtected.toLocaleString()} |`,
      `| 폐업 추정 비활성화 | ${result.deactivated.toLocaleString()} |`,
      `| 재오픈(비활성화 → 복구) | ${result.reactivated.toLocaleString()} |`,
      `| 갱신 후 노출 매장 / 전체 | ${after[0].active.toLocaleString()} / ${after[0].total.toLocaleString()} |`,
      `| API 호출 | ${crawlResult.callCount.toLocaleString()} |`,
    ];
    if (result.deactivationSkipped) lines.push("", `> ⚠️ ${result.deactivationSkipped}`);
    const summary = lines.join("\n");
    console.log(`\n${summary}\n`);
    writeJobSummary(summary);
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  writeJobSummary(`## 매장 데이터 갱신 실패\n\n${err.message || err}\n\nDB는 변경되지 않았습니다.`);
  process.exitCode = 1;
});
