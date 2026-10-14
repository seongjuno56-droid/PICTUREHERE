/**
 * nationwideGrid.js
 * ==================
 * 전국을 반경 10km 원으로 틈 없이 덮는 격자 포인트 목록. 전국 사진촬영업 수집
 * (scripts/fetchNationwidePhotoStores.js, scripts/syncStores.js) 양쪽에서 같은 격자를 쓴다.
 */

export const NATIONWIDE_RADIUS_M = 10000; // API가 허용하는 최대 반경(실측 확인됨: 15000 이상은 INVALID_REQUEST_PARAMETER_ERROR)
const GRID_SPACING_KM = 12; // 10km 반경 원으로 틈 없이 덮으려면 spacing <= radius*sqrt(2)≈14.14km
const LAT_MIN = 33.0; // 제주/마라도 포함
const LAT_MAX = 38.65; // 강원 고성군 등 DMZ 인근까지
const LON_MIN = 124.5; // 백령도 등 서해 도서 포함
const LON_MAX = 131.0; // 울릉도/독도 포함

const KM_PER_LAT_DEG = 111;

/** @returns {{cx: number, cy: number}[]} 격자 포인트(경도 cx, 위도 cy) */
export function buildNationwideGrid() {
  const points = [];
  const latStepDeg = GRID_SPACING_KM / KM_PER_LAT_DEG;
  for (let lat = LAT_MIN; lat <= LAT_MAX; lat += latStepDeg) {
    const kmPerLonDegHere = KM_PER_LAT_DEG * Math.cos((lat * Math.PI) / 180);
    const lonStepDeg = GRID_SPACING_KM / kmPerLonDegHere;
    for (let lon = LON_MIN; lon <= LON_MAX; lon += lonStepDeg) {
      points.push({ cy: Number(lat.toFixed(6)), cx: Number(lon.toFixed(6)) });
    }
  }
  return points;
}
