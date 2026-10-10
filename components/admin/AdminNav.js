"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/stores", label: "매장 관리" },
  { href: "/admin/inquiries", label: "고객센터 관리" },
  { href: "/admin/logs", label: "로그 관리" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <nav
      style={{
        width: 220,
        flexShrink: 0,
        borderRight: "1px solid var(--divider)",
        minHeight: "100vh",
        padding: "24px 16px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px", marginBottom: 28 }}>
        <img src="/brand/mark.svg" alt="" width={26} height={26} style={{ borderRadius: 7 }} />
        <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>픽처히어 어드민</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "block",
                padding: "10px 12px",
                borderRadius: "var(--radius-sm)",
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                color: active ? "#fff" : "var(--text-secondary)",
                background: active ? "var(--brand)" : "transparent",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <button
        onClick={handleLogout}
        style={{
          marginTop: 12,
          padding: "10px 12px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--divider)",
          background: "transparent",
          color: "var(--text-secondary)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        로그아웃
      </button>
    </nav>
  );
}
