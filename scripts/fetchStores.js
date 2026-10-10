/**
 * scripts/fetchStores.js
 * ========================
 * lib/storeApi.js의 재사용 가능한 로직을 불러와 실제로 실행하는 CLI 스크립트.
 *
 * - .env 를 읽어 서비스키를 로드
 * - cx/cy/radius 조건으로 전체 페이지를 수집
 * - all_stores.csv / photo_booth_stores.csv / category_summary.csv 3개 파일로 저장
 *
 * 조회 조건(cx/cy/radius)은 코드 수정 없이 .env의 STORE_CX / STORE_CY / STORE_RADIUS
 * 값으로 바꿀 수 있다 (안 넣으면 기본값 사용).
 *
 * 실행:
 *   npm install
 *   npm run fetch:stores
 *   STORE_RADIUS=10000 npm run fetch:stores   (반경만 일회성으로 바꿔서 실행)
 */

import "dotenv/config";
import { fetchAllStores, filterPhotoBoothStores, summarizeByCategory } from "../lib/storeApi.js";
import { writeItemsCsv } from "../lib/csv.js";

// 조회 조건 - .env(STORE_CX/STORE_CY/STORE_RADIUS)에서 덮어쓸 수 있는 기본값
const CX = process.env.STORE_CX || "126.680"; // 중심점 경도
const CY = process.env.STORE_CY || "37.465"; // 중심점 위도
const RADIUS = process.env.STORE_RADIUS || "1000"; // 반경(m)
const NUM_OF_ROWS = 1000; // 한 페이지당 받아올 행 수 (공식 상한)

// 출력 파일명
const ALL_STORES_CSV = "all_stores.csv";
const PHOTO_BOOTH_CSV = "photo_booth_stores.csv";
const CATEGORY_SUMMARY_CSV = "category_summary.csv";

function saveItemsToCsv(items, filePath) {
  if (!items.length) {
    console.warn(`[경고] ${filePath} - 저장할 데이터가 없습니다.`);
  }
  writeItemsCsv(items, filePath);
  console.log(`[저장] ${filePath} (${items.length}건)`);
}

function saveSummaryToCsv(summary, filePath) {
  writeItemsCsv(summary, filePath, { fieldnames: ["indsSclsCd", "indsSclsNm", "storeCount"] });
  console.log(`[저장] ${filePath} (${summary.length}개 업종)`);
}

async function main() {
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey) {
    console.error(
      "[오류] .env 파일에 DATA_GO_KR_SERVICE_KEY가 설정되어 있지 않습니다.\n" +
        "       .env.example을 참고해 .env 파일에 서비스키를 입력하세요."
    );
    process.exit(1);
  }

  console.log(`[시작] cx=${CX}, cy=${CY}, radius=${RADIUS}m 반경 상가 데이터 수집 시작`);

  const allItems = await fetchAllStores({
    serviceKey,
    cx: CX,
    cy: CY,
    radius: RADIUS,
    numOfRows: NUM_OF_ROWS,
    onProgress: ({ pageNo, pageItemCount, collected, totalCount }) => {
      console.log(`[진행] pageNo=${pageNo} 수신 ${pageItemCount}건 (누적 ${collected}/${totalCount})`);
    },
  });

  // 1) 전체 데이터 CSV
  saveItemsToCsv(allItems, ALL_STORES_CSV);

  // 2) 포토부스/사진촬영업 매장 CSV
  const photoItems = filterPhotoBoothStores(allItems);
  saveItemsToCsv(photoItems, PHOTO_BOOTH_CSV);

  // 3) 업종 소분류별 매장 수 요약 CSV
  const summary = summarizeByCategory(allItems);
  saveSummaryToCsv(summary, CATEGORY_SUMMARY_CSV);

  console.log("[완료] 모든 작업이 끝났습니다.");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
