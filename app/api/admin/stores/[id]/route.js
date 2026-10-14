import { NextResponse } from "next/server";
import { query } from "../../../../../lib/db.js";

const EDITABLE_FIELDS = {
  name: "name",
  branchName: "branch_name",
  categoryName: "category_name",
  type: "type",
  brand: "brand",
  ctprvnName: "ctprvn_name",
  signguName: "signgu_name",
  roadAddress: "road_address",
  lotAddress: "lot_address",
  lat: "lat",
  lon: "lon",
  phone: "phone",
  isActive: "is_active",
};

export async function PATCH(request, { params }) {
  const { id } = await params;
  const body = await request.json();

  if (body.type !== undefined && body.type !== "booth" && body.type !== "studio") {
    return NextResponse.json({ error: "유형은 booth 또는 studio여야 합니다." }, { status: 400 });
  }

  // 사진관으로 바뀌면(혹은 사진관으로 저장되면) 브랜드는 항상 null("-") — booth일 때만 의미가 있음
  if (body.type === "studio" && body.brand === undefined) {
    body.brand = null;
  }

  const setClauses = [];
  const values = [];

  for (const [key, column] of Object.entries(EDITABLE_FIELDS)) {
    if (body[key] === undefined) continue;
    let value = body[key];
    if (key === "lat" || key === "lon") value = Number(value);
    values.push(value);
    setClauses.push(`${column} = $${values.length}`);
  }

  if (setClauses.length === 0) {
    return NextResponse.json({ error: "변경할 값이 없습니다." }, { status: 400 });
  }

  setClauses.push("updated_at = now()");
  values.push(id);

  const runUpdate = (clauses) =>
    query(
      `update stores set ${clauses.join(", ")}
       where id = $${values.length}
       returning id, bizes_id, name, branch_name, category_name, type, brand, ctprvn_name, signgu_name, road_address, lot_address, lat, lon, phone, is_active, view_count, created_at, updated_at`,
      values
    );

  // 어드민에서 직접 고친 매장은 정기 데이터 갱신(scripts/syncStores.js)이 덮어쓰거나
  // 폐업 추정으로 비활성화하지 않도록 표시해둔다. 스키마(db/schema.sql)가 아직 적용 안 된
  // DB라 컬럼이 없으면(42703 undefined_column) 표시 없이 예전처럼 수정만 한다.
  let rows;
  try {
    ({ rows } = await runUpdate([...setClauses, "admin_edited_at = now()"]));
  } catch (err) {
    if (err.code !== "42703") throw err;
    ({ rows } = await runUpdate(setClauses));
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "매장을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ store: rows[0] });
}

export async function DELETE(_request, { params }) {
  const { id } = await params;
  const { rowCount } = await query("delete from stores where id = $1", [id]);

  if (rowCount === 0) {
    return NextResponse.json({ error: "매장을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
