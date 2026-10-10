/**
 * geo.js
 * =======
 * 화면 단 반경(3km/5km/10km) 필터를 위한 거리 계산 유틸.
 *
 * 설계 의도: storeListInRadius API를 화면 필터가 바뀔 때마다 다시 호출하면
 * (반경이 클 경우 호출 횟수가 수십~수백 페이지라 느리고, 포털의 일일 호출 제한에도
 * 걸릴 수 있음) UX가 나빠진다. 그래서 가장 넓은 반경(예: 10km)으로 데이터를
 * 한 번만 수집해 저장해두고, 화면의 3/5/10km 필터는 저장된 데이터에서
 * "중심점~매장 간 실제 거리"를 계산해 걸러내는 방식을 쓴다.
 *
 * Next.js에서도 그대로 import해서 API Route/Server Component에서 쓸 수 있다.
 */

const EARTH_RADIUS_M = 6371000; // 지구 평균 반지름(m)

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * 두 좌표(위도/경도) 사이의 직선 거리를 미터 단위로 계산한다 (Haversine 공식).
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} 거리(m)
 */
export function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const rLat1 = toRadians(lat1);
  const rLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_M * c;
}

/**
 * 매장 아이템(item.lat, item.lon 보유)에 중심점으로부터의 거리(m)를 붙여서 반환한다.
 * storeApi.js가 반환하는 아이템은 상가(상권)정보 API 스펙상 lat/lon 필드를 갖는다.
 */
export function withDistance(items, centerLat, centerLon) {
  return items.map((item) => ({
    ...item,
    distanceM: haversineDistanceMeters(centerLat, centerLon, Number(item.lat), Number(item.lon)),
  }));
}

/**
 * 중심점(centerLat, centerLon) 기준 radiusM(미터) 이내의 매장만 걸러낸다.
 * 화면의 3km/5km/10km 필터 버튼이 바로 이 함수를 호출하면 된다.
 *
 * @param {object[]} items - lat/lon 필드를 가진 매장 배열 (storeApi.js의 fetchAllStores 결과)
 * @param {object} center
 * @param {number} center.lat
 * @param {number} center.lon
 * @param {number} radiusM - 필터링할 반경(m). 예: 3000, 5000, 10000
 * @returns {object[]} 거리순 정렬 + distanceM 필드가 추가된 매장 배열
 */
export function filterByRadius(items, { lat: centerLat, lon: centerLon }, radiusM) {
  return withDistance(items, centerLat, centerLon)
    .filter((item) => item.distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM);
}
