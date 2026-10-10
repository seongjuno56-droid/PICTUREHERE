// PC 화면에서만 보이는 좌측 사이드바 헤더(brand-panel 클래스는 globals.css 미디어쿼리로
// 1024px 미만에서 display:none 처리됨, PC에서는 position:sticky로 스크롤해도 맨 위에
// 고정됨). 네이버지도 데스크톱 구조 참고 — 로고 + 검색/필터만 여기 담당한다. 결과
// 리스트/로드뷰/푸터는 더 이상 이 컴포넌트 안에서 따로 스크롤하지 않고, 부모
// (MapViewKakao.js의 .sidebar-scroll)가 전부 하나의 연속 스크롤로 묶어서 보여준다 —
// 예전엔 리스트 따로, 로드뷰 따로 스크롤돼서 "섹션별로 끊기는" 느낌이었다.
export default function BrandPanel({ children }) {
  return (
    <div className="brand-panel">
      {/* 로고/이름만 작게, 네이버지도처럼 바로 검색창이 나오도록 큰 헤드라인은 뺐다.
          아래 검색 영역과 너무 붙어 보이지 않도록 하단 여백을 넉넉히 줬다. */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "22px 20px 28px" }}>
        <img src="/brand/mark.svg" alt="" width={26} height={26} style={{ borderRadius: 7 }} />
        <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>픽처히어</span>
      </div>

      {/* 검색/필터 컨트롤 (SearchControls) 자리 */}
      <div style={{ padding: "0 20px 16px" }}>{children}</div>
    </div>
  );
}
