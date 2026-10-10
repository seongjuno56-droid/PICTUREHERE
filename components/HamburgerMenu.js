"use client";

import { useEffect, useState } from "react";

// 네이버지도 모바일의 우측 슬라이드 드로어 구조를 참고해서 짠 메뉴.
// 이용약관 및 정책/고객센터 — 아직 실제 페이지가 없는 항목이라, 가짜 링크를 만드는 대신
// 누르면 짧은 안내 토스트만 뜨게 해뒀다.

const APP_VERSION = "0.1.0"; // package.json과 맞춰둔 값
const LAST_UPDATED = "2026.10.09";

function IconDocument() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 3h9l3 3v15H6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 10h6M9 14h6M9 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconHeadset() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 13v-1a8 8 0 0 1 16 0v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="3" y="13" width="4" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="17" y="13" width="4" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M19 19v1a2 2 0 0 1-2 2h-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MenuRow({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        border: "none",
        background: "transparent",
        padding: "13px 20px",
        fontSize: 15,
        fontWeight: 600,
        color: "var(--text-primary)",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span style={{ color: "var(--brand)", display: "flex" }}>{icon}</span>
      {label}
    </button>
  );
}

const MENU_ITEMS = [
  { icon: <IconDocument />, label: "이용약관 및 정책" },
  { icon: <IconHeadset />, label: "고객센터" },
];

export default function HamburgerMenu({ open, onClose, radiusM }) {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!open) setToast(null);
  }, [open]);

  return (
    <>
      {/* 백드롭 */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          zIndex: 2000,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 200ms ease",
        }}
      />

      {/* 드로어 패널 */}
      <div
        role="dialog"
        aria-label="메뉴"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(300px, 82vw)",
          background: "var(--surface-1)",
          zIndex: 2001,
          display: "flex",
          flexDirection: "column",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 220ms ease",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.5)",
        }}
      >
        {/* 헤더 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src="/brand/mark.svg" alt="" width={26} height={26} style={{ borderRadius: 7 }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>픽처히어</span>
          </div>
          <button
            onClick={onClose}
            aria-label="메뉴 닫기"
            style={{
              border: "none",
              background: "var(--surface-2)",
              color: "var(--text-secondary)",
              width: 28,
              height: 28,
              borderRadius: "50%",
              cursor: "pointer",
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ height: 1, background: "var(--divider)" }} />

        {/* 메뉴 */}
        <nav style={{ padding: "8px 0" }}>
          {MENU_ITEMS.map((item) => (
            <MenuRow key={item.label} icon={item.icon} label={item.label} onClick={() => setToast(`${item.label} — 준비 중인 기능이에요`)} />
          ))}
        </nav>

        <div style={{ height: 1, background: "var(--divider)" }} />

        {/* 연한 정보 블록 — 반경/데이터출처/도보시간 안내/버전/업데이트일을 전부 조용한 톤으로 */}
        <div style={{ padding: "16px 20px", flex: 1 }}>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.7, margin: 0 }}>
            검색 반경 {(radiusM / 1000).toFixed(0)}km · 공공데이터포털 · 카카오맵
            <br />
            도보 시간은 직선거리 기준 추정치예요
            <br />v{APP_VERSION} · {LAST_UPDATED} 업데이트
          </p>
        </div>

        {/* 토스트 */}
        {toast && (
          <div
            style={{
              position: "absolute",
              left: 16,
              right: 16,
              bottom: 16,
              background: "var(--surface-2)",
              color: "var(--text-primary)",
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 8,
              padding: "12px 16px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            }}
          >
            {toast}
          </div>
        )}
      </div>
    </>
  );
}
