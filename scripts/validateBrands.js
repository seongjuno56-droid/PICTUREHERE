/**
 * scripts/validateBrands.js
 * ============================
 * 이미 저장된 all_stores.csv를 알려진 즉석사진 프랜차이즈 브랜드 목록
 * (lib/photoBoothBrands.js)과 교차검증한다. 공공데이터 API는 다시 호출하지 않는다.
 *
 * 생성 파일:
 *   - photo_booth_brand_matches.csv : 브랜드명으로 매칭된 매장 (matchedBrand 컬럼 포함)
 *   - brand_match_summary.csv       : 브랜드별 매칭 건수
 *
 * 콘솔에는 기존 키워드 필터(photo_booth_stores.csv) 결과와의 교차검증 결과도 출력한다:
 *   - 브랜드로는 잡히는데 기존 키워드 필터로는 안 잡힌 매장(brandOnly) → 필터 보강 후보
 *   - 키워드 필터로는 잡히는데 알려진 브랜드명과는 매칭 안 되는 매장(keywordOnly)
 *     → 비프랜차이즈 개인 사진관이거나, 생소한 브랜드일 수 있음 (검토 필요)
 *
 * 실행: node scripts/validateBrands.js
 */

import { readItemsCsv, writeItemsCsv } from "../lib/csv.js";
import { filterPhotoBoothStores } from "../lib/storeApi.js";
import { matchKnownBrand, PHOTO_BOOTH_BRANDS } from "../lib/photoBoothBrands.js";

const ALL_STORES_CSV = "all_stores.csv";
const BRAND_MATCHES_CSV = "photo_booth_brand_matches.csv";
const BRAND_SUMMARY_CSV = "brand_match_summary.csv";

const allItems = readItemsCsv(ALL_STORES_CSV);
console.log(`[로드] ${ALL_STORES_CSV} (${allItems.length}건)`);

// 1) 브랜드명 기준 매칭
const brandCounts = new Map(PHOTO_BOOTH_BRANDS.map((b) => [b.name, 0]));
const brandMatchedItems = [];

for (const item of allItems) {
  const brands = matchKnownBrand(item);
  if (brands.length > 0) {
    for (const b of brands) brandCounts.set(b, (brandCounts.get(b) ?? 0) + 1);
    brandMatchedItems.push({ ...item, matchedBrand: brands.join("|") });
  }
}

writeItemsCsv(brandMatchedItems, BRAND_MATCHES_CSV);
console.log(`[저장] ${BRAND_MATCHES_CSV} (${brandMatchedItems.length}건)`);

const brandSummary = Array.from(brandCounts.entries())
  .map(([brandName, storeCount]) => ({ brandName, storeCount }))
  .sort((a, b) => b.storeCount - a.storeCount);
writeItemsCsv(brandSummary, BRAND_SUMMARY_CSV, { fieldnames: ["brandName", "storeCount"] });
console.log(`[저장] ${BRAND_SUMMARY_CSV}`);

console.log("\n[브랜드별 매칭 건수 (10km 반경 내)]");
for (const row of brandSummary) {
  if (row.storeCount > 0) console.log(`  ${row.brandName}: ${row.storeCount}건`);
}

// 2) 기존 키워드 필터(storeApi.js)와 교차검증
const keywordMatchedItems = filterPhotoBoothStores(allItems);
const keywordMatchedIds = new Set(keywordMatchedItems.map((i) => i.bizesId));
const brandMatchedIds = new Set(brandMatchedItems.map((i) => i.bizesId));

const brandOnly = brandMatchedItems.filter((i) => !keywordMatchedIds.has(i.bizesId));
const keywordOnly = keywordMatchedItems.filter((i) => !brandMatchedIds.has(i.bizesId));
const both = brandMatchedItems.filter((i) => keywordMatchedIds.has(i.bizesId));

console.log("\n[교차검증 결과]");
console.log(`  기존 키워드 필터 매칭: ${keywordMatchedItems.length}건`);
console.log(`  브랜드명 필터 매칭: ${brandMatchedItems.length}건`);
console.log(`  두 필터 모두 매칭(겹침): ${both.length}건`);
console.log(`  브랜드로만 잡힘 (키워드 필터가 놓친 것, 보강 필요): ${brandOnly.length}건`);
console.log(`  키워드로만 잡힘 (알려진 브랜드가 아닌 매장 - 개인샵/생소 브랜드 가능): ${keywordOnly.length}건`);

if (brandOnly.length > 0) {
  console.log("\n  [브랜드로만 잡힌 매장 샘플 (최대 15개)]");
  for (const item of brandOnly.slice(0, 15)) {
    console.log(`    - ${item.bizesNm} ${item.brchNm || ""} (${item.matchedBrand}) / ${item.rdnmAdr || item.lnoAdr}`);
  }
}
