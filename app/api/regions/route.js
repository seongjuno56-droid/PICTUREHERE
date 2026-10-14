/**
 * GET /api/regions
 *
 * "지역 검색" 탭의 시/도 · 시/군/구 셀렉트 박스 옵션용 — stores 테이블에 실제로 매장이
 * 있는 지역만 내려준다(빈 지역을 골라서 결과 0개가 나오는 일이 없도록). 어드민용
 * /api/admin/regions와 같은 쿼리지만, 그쪽은 로그인 뒤에 있어서 일반 사용자용으로 따로
 * 뒀고 비활성 매장만 있는 지역은 뺐다.
 */
import { NextResponse } from "next/server";
import { query } from "../../../lib/db.js";

export async function GET() {
  const { rows } = await query(
    `select distinct ctprvn_name, signgu_name
     from stores
     where is_active = true and ctprvn_name is not null
     order by ctprvn_name, signgu_name`
  );

  const byCtprvn = new Map();
  for (const row of rows) {
    if (!byCtprvn.has(row.ctprvn_name)) byCtprvn.set(row.ctprvn_name, []);
    if (row.signgu_name) byCtprvn.get(row.ctprvn_name).push(row.signgu_name);
  }

  const regions = Array.from(byCtprvn.entries()).map(([ctprvn, signgus]) => ({ ctprvn, signgus }));

  return NextResponse.json({ regions });
}
