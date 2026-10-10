/**
 * GET /api/stations?q=주안
 *
 * "역 근처 검색"용 — 카카오 로컬 키워드 검색(지하철역 카테고리)으로 역 이름을
 * 좌표로 변환한다. REST API 키는 서버에서만 쓰고 브라우저에 노출하지 않는다.
 */
import { NextResponse } from "next/server";

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const SUBWAY_STATION_CATEGORY = "SW8"; // 카카오 로컬 카테고리 코드: 지하철역

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ stations: [] });
  }
  if (!KAKAO_REST_API_KEY) {
    return NextResponse.json(
      { error: ".env에 KAKAO_REST_API_KEY가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.searchParams.set("query", query);
  url.searchParams.set("category_group_code", SUBWAY_STATION_CATEGORY);
  url.searchParams.set("size", "8");

  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `카카오 로컬 API 오류 (${res.status}): ${text.slice(0, 300)}` },
      { status: 502 }
    );
  }

  const data = await res.json();
  const stations = (data.documents ?? []).map((doc) => ({
    name: doc.place_name,
    lat: Number(doc.y),
    lon: Number(doc.x),
    address: doc.road_address_name || doc.address_name,
  }));

  return NextResponse.json({ stations });
}
