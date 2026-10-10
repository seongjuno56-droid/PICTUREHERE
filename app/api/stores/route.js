/**
 * GET /api/stores?radius=3000&lat=37.465&lon=126.680
 * GET /api/stores?region=포토이즘&lat=37.465&lon=126.680   (통합 검색 — 전국 대상, 반경 무시)
 *
 * 기본 모드: stores 테이블(전국 데이터, 어드민에서 편집 가능)에서 중심점 기준 대략적인
 * 위경도 바운딩 박스로 1차로 좁혀온 뒤, Haversine 거리 계산으로 radius(m) 이내만
 * 정확히 걸러 반환한다. 화면 필터(3/5/10km)가 바뀔 때마다 이 route를 부르면 되고,
 * 공공데이터포털 API는 다시 호출하지 않는다.
 *
 * region 모드: 검색창 하나로 매장명/지역/주소를 한꺼번에 찾는 통합검색에서 쓴다. 지금
 * 지도 중심이 어디든 상관없이 전국에서 매장명·지점명·주소·시도·시군구 중 하나라도
 * region 텍스트를 포함하는 매장을 전부(최대 500개) 찾는다 — 반경 바운딩 박스를 아예 안
 * 씀. distanceM은 정렬/표시용으로만 계산한다.
 */
import { NextResponse } from "next/server";
import { query } from "../../../lib/db.js";
import { filterByRadius, withDistance } from "../../../lib/geo.js";

const DEFAULT_CENTER = {
  lat: Number(process.env.STORE_CY) || 37.465,
  lon: Number(process.env.STORE_CX) || 126.68,
};

const KM_PER_LAT_DEG = 111;
const REGION_SEARCH_LIMIT = 500;

function toStoreShape(item) {
  return {
    bizesId: item.bizesId,
    bizesNm: item.bizesNm,
    brchNm: item.brchNm,
    indsSclsNm: item.indsSclsNm,
    type: item.type, // "booth"(포토부스) | "studio"(사진관) — stores 테이블에 저장된 값
    brand: item.brand, // booth일 때만 의미 있음(studio는 항상 null)
    rdnmAdr: item.rdnmAdr,
    lnoAdr: item.lnoAdr,
    lat: Number(item.lat),
    lon: Number(item.lon),
    distanceM: Math.round(item.distanceM),
  };
}

const STORE_COLUMNS = `bizes_id as "bizesId", name as "bizesNm", branch_name as "brchNm",
            category_name as "indsSclsNm", type, brand, road_address as "rdnmAdr",
            lot_address as "lnoAdr", lat, lon`;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat")) || DEFAULT_CENTER.lat;
  const lon = Number(searchParams.get("lon")) || DEFAULT_CENTER.lon;
  const region = (searchParams.get("region") || "").trim();

  if (region) {
    const { rows } = await query(
      `select ${STORE_COLUMNS}
       from stores
       where is_active = true
         and (name ILIKE $1 OR branch_name ILIKE $1 OR road_address ILIKE $1 OR lot_address ILIKE $1
              OR ctprvn_name ILIKE $1 OR signgu_name ILIKE $1)
       limit ${REGION_SEARCH_LIMIT}`,
      [`%${region}%`]
    );

    const sorted = withDistance(rows, lat, lon).sort((a, b) => a.distanceM - b.distanceM);

    return NextResponse.json({
      center: { lat, lon },
      region,
      count: sorted.length,
      stores: sorted.map(toStoreShape),
    });
  }

  const radiusM = Number(searchParams.get("radius")) || 3000;

  // 정확한 반경 필터는 JS에서 Haversine으로 하되, DB에서는 여유 있는 바운딩 박스로만
  // 1차 추려서 불필요한 행을 덜 가져온다 (여유분 1.3배 — 경계 부근 누락 방지).
  const latDelta = ((radiusM / 1000) * 1.3) / KM_PER_LAT_DEG;
  const lonDelta = ((radiusM / 1000) * 1.3) / (KM_PER_LAT_DEG * Math.cos((lat * Math.PI) / 180));

  const { rows } = await query(
    `select ${STORE_COLUMNS}
     from stores
     where is_active = true
       and lat between $1 and $2
       and lon between $3 and $4`,
    [lat - latDelta, lat + latDelta, lon - lonDelta, lon + lonDelta]
  );

  const filtered = filterByRadius(rows, { lat, lon }, radiusM);

  return NextResponse.json({
    center: { lat, lon },
    radiusM,
    count: filtered.length,
    stores: filtered.map(toStoreShape),
  });
}
