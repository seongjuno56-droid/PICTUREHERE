/**
 * scripts/fetchNationwidePhotoStores.js
 * =======================================
 * 로컬(주안 10km) 샘플이 아니라, 전국을 10km 반경 원으로 격자 타일링하면서
 * storeListInRadius를 indsSclsCd=M11301(사진촬영업) 서버 필터와 함께 호출해
 * 전국 사진관/포토부스(사진촬영업으로 등록된 매장) 데이터를 모은다.
 *
 * 왜 전수(무필터) 크롤링을 안 하나: 서울 강남 1km 반경만 해도 전업종 totalCount가
 * 17,475건 — 전국을 무필터로 격자 커버하면 (10km 반경 겹침까지 감안) 최소 수만~
 * 수십만 페이지 호출이 필요해 비현실적. indsSclsCd 서버 필터를 쓰면 같은 지점이
 * 10km 기준 최대 ~5000건(서울 도심 기준)으로 줄어 전국 격자가 현실적인 호출량
 * (추정 수천 건)으로 끝난다. 단, 상호명 키워드로만 걸리고 업종코드가 다른 극소수
 * 프랜차이즈(로컬 샘플 903건 중 7건, 0.8%)는 이 방식으로는 못 잡는다 — 알려진 한계.
 *
 * 체크포인트: 격자 포인트 단위로 진행 상황과 누적 데이터를 디스크에 주기적으로
 * 저장해서, 중간에 네트워크 오류/프로세스 종료가 나도 재실행 시 이어서 할 수 있다.
 *
 * 실행: node scripts/fetchNationwidePhotoStores.js
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAllStores, PHOTO_STUDIO_INDS_SCLS_CD } from "../lib/storeApi.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROGRESS_PATH = path.join(__dirname, ".nationwide_progress.json");
const ITEMS_PATH = path.join(__dirname, "..", "nationwide_photo_studio_stores.json");

const RADIUS_M = 10000; // API가 허용하는 최대 반경(실측 확인됨: 15000 이상은 INVALID_REQUEST_PARAMETER_ERROR)
const GRID_SPACING_KM = 12; // 10km 반경 원으로 틈 없이 덮으려면 spacing <= radius*sqrt(2)≈14.14km
const LAT_MIN = 33.0; // 제주/마라도 포함
const LAT_MAX = 38.65; // 강원 고성군 등 DMZ 인근까지
const LON_MIN = 124.5; // 백령도 등 서해 도서 포함
const LON_MAX = 131.0; // 울릉도/독도 포함

const KM_PER_LAT_DEG = 111;

function buildGrid() {
  const points = [];
  const latStepDeg = GRID_SPACING_KM / KM_PER_LAT_DEG;
  let latIdx = 0;
  for (let lat = LAT_MIN; lat <= LAT_MAX; lat += latStepDeg, latIdx += 1) {
    const kmPerLonDegHere = KM_PER_LAT_DEG * Math.cos((lat * Math.PI) / 180);
    const lonStepDeg = GRID_SPACING_KM / kmPerLonDegHere;
    for (let lon = LON_MIN; lon <= LON_MAX; lon += lonStepDeg) {
      points.push({ cy: Number(lat.toFixed(6)), cx: Number(lon.toFixed(6)) });
    }
  }
  return points;
}

function loadProgress() {
  if (!fs.existsSync(PROGRESS_PATH)) return { completedIndexes: [] };
  return JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf8"));
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress));
}

function loadItemsMap() {
  if (!fs.existsSync(ITEMS_PATH)) return new Map();
  const arr = JSON.parse(fs.readFileSync(ITEMS_PATH, "utf8"));
  return new Map(arr.map((item) => [item.bizesId, item]));
}

function saveItemsMap(map) {
  fs.writeFileSync(ITEMS_PATH, JSON.stringify(Array.from(map.values())));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey) throw new Error("DATA_GO_KR_SERVICE_KEY가 .env에 없습니다.");

  const grid = buildGrid();
  const progress = loadProgress();
  const completed = new Set(progress.completedIndexes);
  const itemsMap = loadItemsMap();

  console.log(`격자 포인트 ${grid.length}개 중 ${completed.size}개 완료된 상태로 시작`);

  let callCount = 0;
  const startedAt = Date.now();

  for (let i = 0; i < grid.length; i += 1) {
    if (completed.has(i)) continue;
    const { cx, cy } = grid[i];

    try {
      const items = await fetchAllStores({
        serviceKey,
        cx,
        cy,
        radius: RADIUS_M,
        indsSclsCd: PHOTO_STUDIO_INDS_SCLS_CD,
        onProgress: () => {
          callCount += 1;
        },
      });

      for (const item of items) {
        if (item.bizesId) itemsMap.set(item.bizesId, item);
      }
    } catch (err) {
      console.error(`[${i}/${grid.length}] cx=${cx} cy=${cy} 실패: ${err.message} — 이 포인트는 건너뛰고 계속`);
      // 실패한 포인트는 completed에 넣지 않아 다음 실행 때 재시도된다.
      await sleep(500);
      continue;
    }

    completed.add(i);

    if (i % 20 === 0 || i === grid.length - 1) {
      saveProgress({ completedIndexes: Array.from(completed) });
      saveItemsMap(itemsMap);
      const elapsedMin = ((Date.now() - startedAt) / 60000).toFixed(1);
      console.log(
        `[${i + 1}/${grid.length}] 누적 매장 ${itemsMap.size}건 · API 호출 ${callCount}회 · ${elapsedMin}분 경과`
      );
    }

    await sleep(150); // 공공데이터포털에 과도한 연속 호출을 피하기 위한 최소 간격
  }

  saveProgress({ completedIndexes: Array.from(completed) });
  saveItemsMap(itemsMap);
  console.log(`완료. 전국 사진촬영업(M11301) 매장 ${itemsMap.size}건 수집, 총 API 호출 ${callCount}회`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
