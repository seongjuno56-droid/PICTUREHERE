import { NextResponse } from "next/server";
import { query } from "../../../../lib/db.js";
import { pickBrandLabel } from "../../../../lib/photoBoothBrands.js";

const PAGE_SIZE = 20;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const type = searchParams.get("type") || ""; // "" | "booth" | "studio"
  const ctprvn = searchParams.get("ctprvn") || "";
  const signgu = searchParams.get("signgu") || "";
  const brand = searchParams.get("brand") || "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const where = [];
  const params = [];

  if (q) {
    params.push(`%${q}%`);
    where.push(`(name ILIKE $${params.length} OR branch_name ILIKE $${params.length} OR road_address ILIKE $${params.length})`);
  }
  if (type === "booth" || type === "studio") {
    params.push(type);
    where.push(`type = $${params.length}`);
  }
  if (ctprvn) {
    params.push(ctprvn);
    where.push(`ctprvn_name = $${params.length}`);
  }
  if (signgu) {
    params.push(signgu);
    where.push(`signgu_name = $${params.length}`);
  }
  if (brand) {
    params.push(brand);
    where.push(`brand = $${params.length}`);
  }

  const whereSql = where.length ? `where ${where.join(" and ")}` : "";

  const countRes = await query(`select count(*)::int as count from stores ${whereSql}`, params);
  const total = countRes.rows[0].count;

  params.push(PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const listRes = await query(
    `select id, bizes_id, name, branch_name, category_name, type, brand, ctprvn_name, signgu_name,
            road_address, lot_address, lat, lon, phone, is_active, created_at, updated_at
     from stores ${whereSql}
     order by created_at desc
     limit $${params.length - 1} offset $${params.length}`,
    params
  );

  return NextResponse.json({
    total,
    page,
    pageSize: PAGE_SIZE,
    stores: listRes.rows,
  });
}

export async function POST(request) {
  const body = await request.json();
  const { name, branchName, categoryName, type, roadAddress, lotAddress, lat, lon, phone, ctprvnName, signguName } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "매장명을 입력해주세요." }, { status: 400 });
  }
  if (type !== "booth" && type !== "studio") {
    return NextResponse.json({ error: "유형은 booth 또는 studio여야 합니다." }, { status: 400 });
  }
  const latNum = Number(lat);
  const lonNum = Number(lon);
  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
    return NextResponse.json({ error: "위도/경도가 올바르지 않습니다." }, { status: 400 });
  }

  // 브랜드는 포토부스만 의미가 있음 — 직접 지정 안 하면 이름으로 자동 분류, 사진관은 항상 null("-")
  const brand = type === "booth" ? body.brand || pickBrandLabel({ bizesNm: name, brchNm: branchName }) : null;

  const { rows } = await query(
    `insert into stores (name, branch_name, category_name, type, brand, ctprvn_name, signgu_name, road_address, lot_address, lat, lon, phone)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     returning id, bizes_id, name, branch_name, category_name, type, brand, ctprvn_name, signgu_name, road_address, lot_address, lat, lon, phone, is_active, created_at, updated_at`,
    [
      name,
      branchName || null,
      categoryName || null,
      type,
      brand,
      ctprvnName || null,
      signguName || null,
      roadAddress || null,
      lotAddress || null,
      latNum,
      lonNum,
      phone || null,
    ]
  );

  return NextResponse.json({ store: rows[0] }, { status: 201 });
}
