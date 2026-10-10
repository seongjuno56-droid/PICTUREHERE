import { Pool } from "pg";

// Next.js 개발 모드 핫리로드 시 Pool이 중복 생성되는 걸 막기 위해 globalThis에 캐싱.
const globalForPg = globalThis;

export const pool =
  globalForPg.__pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

if (!globalForPg.__pgPool) {
  globalForPg.__pgPool = pool;
}

export function query(text, params) {
  return pool.query(text, params);
}
