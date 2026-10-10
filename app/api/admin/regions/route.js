import { NextResponse } from "next/server";
import { query } from "../../../../lib/db.js";

export async function GET() {
  const { rows } = await query(
    `select distinct ctprvn_name, signgu_name
     from stores
     where ctprvn_name is not null
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
