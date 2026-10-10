// PC 화면에서만 보이는 좌측 사이드바(brand-panel 클래스는 globals.css 미디어쿼리로
// 1024px 미만에서 display:none 처리됨). 네이버지도 데스크톱 구조 참고 — 상단에 검색/필터,
// 그 아래 스크롤되는 결과 리스트. 조용한 정보 푸터(반경/출처/버전)는 로드뷰 패널 밑
// 사이드바 맨 아래에 별도 그리드 행(.sidebar-footer, MapViewKakao.js)으로 따로 둔다 —
// 여기 안에 있으면 로드뷰 패널이 그 밑에 또 붙어서 "중간에 떠 있는" 것처럼 보였다.
export default function BrandPanel({ children, nearestList }) {
  return (
    <div className="brand-panel">
      {/* 상단 — 로고/이름만 작게, 네이버지도처럼 바로 검색창이 나오도록 큰 헤드라인은 뺐다.
          아래 검색 영역과 너무 붙어 보이지 않도록 하단 여백을 넉넉히 줬다. */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "22px 20px 28px" }}>
        <img src="/brand/mark.svg" alt="" width={26} height={26} style={{ borderRadius: 7 }} />
        <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>픽처히어</span>
      </div>

      {/* 검색/필터 컨트롤 (SearchControls) 자리 */}
      <div style={{ padding: "0 20px 16px" }}>{children}</div>

      <div style={{ height: 1, background: "var(--divider)" }} />

      {/* 결과 리스트 — 남은 세로 공간을 채우며 그 안에서만 스크롤 */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>{nearestList}</div>
    </div>
  );
}
