/**
 * scripts/createAdminUser.js
 * 관리자 계정을 생성/비밀번호 변경한다.
 * 실행: node scripts/createAdminUser.js <username> <password>
 */
import "dotenv/config";
import { Client } from "pg";
import bcrypt from "bcryptjs";

async function main() {
  const [, , username, password] = process.argv;
  if (!username || !password) {
    console.error("usage: node scripts/createAdminUser.js <username> <password>");
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query(
    `insert into admin_users (username, password_hash)
     values ($1, $2)
     on conflict (username) do update set password_hash = excluded.password_hash`,
    [username, passwordHash]
  );
  await client.end();
  console.log(`admin user "${username}" ready`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
