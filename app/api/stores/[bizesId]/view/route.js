/**
 * POST /api/stores/[bizesId]/view
 * 마커 클릭 → 스트릿뷰 상세가 열릴 때마다 호출돼서 조회수를 1 증가시킨다.
 * 동시 요청에도 안전하도록 DB에서 직접 +1 해서(RETURNING) 최신값을 돌려준다.
 */
import { NextResponse } from "next/server";
import { query } from "../../../../../lib/db.js";

export async function POST(_request, { params }) {
  const { bizesId } = await params;

  const { rows } = await query(
    `update stores set view_count = view_count + 1
     where bizes_id = $1
     returning view_count as "viewCount"`,
    [bizesId]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "매장을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ viewCount: rows[0].viewCount });
}
