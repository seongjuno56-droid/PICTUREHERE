/**
 * scripts/rebuildDerived.js
 * ===========================
 * 이미 저장된 all_stores.csv를 다시 읽어서 photo_booth_stores.csv /
 * category_summary.csv 두 파생 파일만 재생성한다. (공공데이터 API를 다시
 * 호출하지 않음 — 파일 잠금(EBUSY) 등으로 저장만 실패했을 때 복구용으로 사용)
 *
 * 실행: node scripts/rebuildDerived.js
 */

import { readItemsCsv, writeItemsCsv } from "../lib/csv.js";
import { filterPhotoBoothStores, summarizeByCategory } from "../lib/storeApi.js";

const ALL_STORES_CSV = "all_stores.csv";
const PHOTO_BOOTH_CSV = "photo_booth_stores.csv";
const CATEGORY_SUMMARY_CSV = "category_summary.csv";

const allItems = readItemsCsv(ALL_STORES_CSV);
console.log(`[로드] ${ALL_STORES_CSV} (${allItems.length}건)`);

const photoItems = filterPhotoBoothStores(allItems);
writeItemsCsv(photoItems, PHOTO_BOOTH_CSV);
console.log(`[저장] ${PHOTO_BOOTH_CSV} (${photoItems.length}건)`);

const summary = summarizeByCategory(allItems);
writeItemsCsv(summary, CATEGORY_SUMMARY_CSV, { fieldnames: ["indsSclsCd", "indsSclsNm", "storeCount"] });
console.log(`[저장] ${CATEGORY_SUMMARY_CSV} (${summary.length}개 업종)`);

console.log("[완료]");
