/**
 * GET /api/stores?radius=3000&lat=37.465&lon=126.680
 * GET /api/stores?ctprvn=서울특별시&signgu=강남구&lat=..&lon=..   (지역 검색 — 반경 무시)
 * GET /api/stores?name=포토이즘&lat=..&lon=..                      (매장명 자동완성 — 전국 대상)
 *
 * 기본 모드: stores 테이블(전국 데이터, 어드민에서 편집 가능)에서 중심점 기준 대략적인
 * 위경도 바운딩 박스로 1차로 좁혀온 뒤, Haversine 거리 계산으로 radius(m) 이내만
 * 정확히 걸러 반환한다. 화면 필터(3/5/10km)가 바뀔 때마다 이 route를 부르면 되고,
 * 공공데이터포털 API는 다시 호출하지 않는다.
 *
 * 지역 모드(ctprvn[, signgu]): "지역 검색" 탭의 시/도·시/군구 셀렉트 박스 값으로 정확히
 * 일치하는 매장을 찾는다. signgu를 비우면 시/도 전체. 예전 통합검색(region=)은 주소 문자열
 * 부분일치라 "중구"처럼 여러 시도에 걸친 이름이 섞여 나와서, 셀렉트 박스 값과 정확히
 * 맞추는 방식으로 바꿨다.
 *
 * 매장명 모드(name): "매장 검색" 탭의 자동완성용 — 매장명/지점명 부분일치, 가까운 순으로
 * 최대 NAME_SEARCH_LIMIT개. distanceM은 정렬/표시용으로만 계산한다.
 */
import { NextResponse } from "next/server";
import { query } from "../../../lib/db.js";
import { filterByRadius, withDistance } from "../../../lib/geo.js";

const DEFAULT_CENTER = {
  lat: Number(process.env.STORE_CY) || 37.465,
  lon: Number(process.env.STORE_CX) || 126.68,
};

const KM_PER_LAT_DEG = 111;
const REGION_SEARCH_LIMIT = 1000;
const NAME_SEARCH_LIMIT = 8;
const NAME_SEARCH_CANDIDATES = 300; // 이만큼 가져와서 거리순 정렬 후 상위 NAME_SEARCH_LIMIT개만

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
    viewCount: Number(item.viewCount) || 0,
  };
}

const STORE_COLUMNS = `bizes_id as "bizesId", name as "bizesNm", branch_name as "brchNm",
            category_name as "indsSclsNm", type, brand, road_address as "rdnmAdr",
            lot_address as "lnoAdr", lat, lon, view_count as "viewCount"`;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat")) || DEFAULT_CENTER.lat;
  const lon = Number(searchParams.get("lon")) || DEFAULT_CENTER.lon;
  const ctprvn = (searchParams.get("ctprvn") || "").trim();
  const signgu = (searchParams.get("signgu") || "").trim();
  const name = (searchParams.get("name") || "").trim();

  if (ctprvn) {
    const { rows } = await query(
      `select ${STORE_COLUMNS}
       from stores
       where is_active = true
         and ctprvn_name = $1
         and ($2 = '' or signgu_name = $2)
       limit ${REGION_SEARCH_LIMIT}`,
      [ctprvn, signgu]
    );

    const sorted = withDistance(rows, lat, lon).sort((a, b) => a.distanceM - b.distanceM);

    return NextResponse.json({
      center: { lat, lon },
      ctprvn,
      signgu: signgu || null,
      count: sorted.length,
      stores: sorted.map(toStoreShape),
    });
  }

  if (name) {
    // 사용자가 입력한 %, _ 가 LIKE 와일드카드로 해석되지 않도록 이스케이프
    const escaped = name.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { rows } = await query(
      `select ${STORE_COLUMNS}
       from stores
       where is_active = true
         and (name || ' ' || coalesce(branch_name, '')) ILIKE $1 -- "포토이즘 강남점"처럼 이어 붙여 쳐도 걸리게
       limit ${NAME_SEARCH_CANDIDATES}`,
      [`%${escaped}%`]
    );

    const sorted = withDistance(rows, lat, lon)
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, NAME_SEARCH_LIMIT);

    return NextResponse.json({
      center: { lat, lon },
      name,
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
