"use client";

// 검색/필터 UI를 작은 조각(named export)으로 나눠서, PC에서는 전부 합쳐 브랜드 패널 카드
// 안에(default export), 모바일에서는 네이버지도 구조에 맞춰 조각을 다른 자리에 따로따로
// 배치한다(상단 고정바엔 검색창만, 지도 위엔 칩으로). 상태는 전부 부모(MapViewKakao)가
// 들고 있고 이 파일의 컴포넌트들은 순수하게 표시/입력만 담당한다.

export const RADIUS_OPTIONS = [
  { label: "3km", meters: 3000 },
  { label: "5km", meters: 5000 },
  { label: "10km", meters: 10000 },
];

// 매장명/지역/역 3탭을 없애고 입력 하나로 통합했다 — 서버(/api/stores?region=)가
// 매장명·지점명·주소·시도·시군구를 한꺼번에 찾아주고, 같은 입력값으로 역 자동완성도
// 동시에 돌린다(MapViewKakao.js). "역" 한 글자짜리 탭 라벨이 안 예뻐서 없앤 것도 있음.
export const SEARCH_PLACEHOLDER = "원하는 지역이나 매장명을 검색하세요";

/**
 * 매장 종류: 포토부스(네컷사진류) / 사진관. `variant="pill"`이면 카드 안이 아니라
 * 지도 위에 떠 있는 독립 칩 모양으로 그려진다(네이버지도의 "일반/위성" 토글 자리).
 */
export function CategoryToggle({ category, setCategory, variant = "boxed" }) {
  const options = [
    { key: "booth", label: "포토부스" },
    { key: "studio", label: "사진관" },
  ];

  if (variant === "select") {
    return (
      <div style={{ position: "relative", display: "inline-block" }}>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="매장 종류"
          style={{
            appearance: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
            border: "1px solid var(--divider)",
            background: "var(--surface-1)",
            color: "var(--text-primary)",
            borderRadius: "var(--radius-pill)",
            padding: "8px 32px 8px 14px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
          }}
        >
          {options.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
        >
          <path d="M6 9l6 6 6-6" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  return (
    <div
      role="tablist"
      aria-label="매장 종류"
      style={{
        display: "flex",
        background: "rgba(255,255,255,0.06)",
        border: "1px solid var(--input-border)",
        borderRadius: "var(--radius-sm)",
        padding: 3,
      }}
    >
      {options.map((opt) => {
        const active = category === opt.key;
        return (
          <button
            key={opt.key}
            role="tab"
            aria-selected={active}
            onClick={() => setCategory(opt.key)}
            style={{
              flex: 1,
              border: "none",
              borderRadius: 5,
              padding: "8px 0",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              background: active ? "var(--brand)" : "transparent",
              color: active ? "#FFFFFF" : "var(--text-secondary)",
              transition: "background 150ms ease, color 150ms ease",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 포토부스 브랜드 필터(select형). 사진관엔 브랜드 개념이 없어서 category==="booth"일
 * 때만 부모가 조건부로 렌더링한다. options는 호출부에서 lib/photoBoothBrands.js 기준으로 넘겨준다.
 * variant="pill"(기본)이면 지도 위에 떠 있는 독립 칩(그림자 있음), "boxed"면 PC 브랜드
 * 패널 카드 안에 자연스럽게 녹아드는 전체 너비 인라인 select(그림자 없음).
 */
export function BrandToggle({ brand, setBrand, options, variant = "pill" }) {
  const boxed = variant === "boxed";
  return (
    <div style={{ position: "relative", display: boxed ? "block" : "inline-block", width: boxed ? "100%" : "auto" }}>
      <select
        value={brand}
        onChange={(e) => setBrand(e.target.value)}
        aria-label="포토부스 브랜드"
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          width: boxed ? "100%" : "auto",
          border: `1px solid ${boxed ? "var(--input-border)" : "var(--divider)"}`,
          background: boxed ? "rgba(255,255,255,0.06)" : "var(--surface-1)",
          color: "var(--text-primary)",
          borderRadius: boxed ? "var(--radius-sm)" : "var(--radius-pill)",
          padding: "8px 32px 8px 14px",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: boxed ? "none" : "0 4px 12px rgba(0,0,0,0.35)",
        }}
      >
        <option value="">전체 브랜드</option>
        {options.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
      >
        <path d="M6 9l6 6 6-6" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** 돋보기 아이콘이 붙은 입력창 한 줄 (공용). 검색 조건 영역이 배경에 묻혀 눈에 잘
 *  안 띈다는 피드백으로, 주변 다크 톤과 대비되는 흰 배경 + 또렷한 테두리로 고정했다. */
function SearchInputRow({ value, onChange, placeholder }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "#FFFFFF",
        border: "1px solid #D5D9E3",
        borderRadius: "var(--radius-pill)",
        padding: "10px 14px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
        <circle cx="11" cy="11" r="7" stroke="#8B92A5" strokeWidth="2" />
        <path d="M21 21l-4.3-4.3" stroke="#8B92A5" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input value={value} onChange={onChange} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

/**
 * 검색 조건: 매장명/지역/역 3개 탭을 없애고 입력창 하나로 통합했다 — 이 값 그대로
 * /api/stores?region=(매장명+주소 통합 서버 검색)과 /api/stations?q=(역 자동완성)에
 * 동시에 쓰인다. 입력값이 비어 있으면 그 자체로 "필터 없음(=내 주변 전체)"이 된다.
 */
export function SearchModeInput({
  searchQuery,
  setSearchQuery,
  stationResults,
  stationLoading,
  stationError,
  selectedStation,
  setSelectedStation,
  pickStation,
  clearStation,
}) {
  return (
    <div>
      <div style={{ position: "relative" }}>
        <SearchInputRow
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (selectedStation) setSelectedStation(null);
          }}
          placeholder={SEARCH_PLACEHOLDER}
        />

        {(stationLoading || stationError || stationResults.length > 0) && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "100%",
              marginTop: 4,
              background: "var(--surface-2)",
              border: "1px solid var(--divider)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              overflow: "hidden",
              zIndex: 1001,
            }}
          >
            {stationLoading && (
              <div style={{ padding: "10px 14px", fontSize: 13, color: "var(--text-secondary)" }}>검색 중...</div>
            )}
            {stationError && (
              <div style={{ padding: "10px 14px", fontSize: 13, color: "#FF7A45" }}>{stationError}</div>
            )}
            {!stationLoading &&
              !stationError &&
              stationResults.map((station) => (
                <button
                  key={`${station.name}-${station.lat}-${station.lon}`}
                  onClick={() => pickStation(station)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    background: "transparent",
                    padding: "10px 14px",
                    cursor: "pointer",
                    borderBottom: "1px solid var(--divider)",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{station.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{station.address}</div>
                </button>
              ))}
          </div>
        )}
      </div>

      {selectedStation && (
        <div style={{ padding: "8px 0 0" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(255,255,255,0.10)",
              color: "var(--text-primary)",
              borderRadius: "var(--radius-pill)",
              padding: "5px 6px 5px 12px",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {selectedStation.name} 기준
            <button
              onClick={clearStation}
              aria-label="역 선택 해제"
              style={{
                border: "none",
                background: "var(--surface-2)",
                borderRadius: "50%",
                width: 18,
                height: 18,
                cursor: "pointer",
                fontSize: 11,
                lineHeight: "18px",
                textAlign: "center",
                color: "var(--text-secondary)",
              }}
            >
              ✕
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * 반경(3/5/10km) + 결과 개수. `variant="pill"`이면 카드 밖, 지도 위에 떠 있는 독립
 * 칩 모양으로 그려진다.
 */
export function RadiusControl({ radiusM, setRadiusM, sdkStatus, loading, fetchError, visibleStoresCount, variant = "boxed" }) {
  if (variant === "pill") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {/* 3km/5km/10km을 각자 떠 있는 버튼이 아니라 테두리 하나로 묶인 탭 그룹으로 */}
        <div
          role="tablist"
          aria-label="검색 반경"
          style={{
            display: "flex",
            background: "var(--surface-1)",
            border: "1px solid var(--divider)",
            borderRadius: "var(--radius-pill)",
            padding: 3,
            boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
          }}
        >
          {RADIUS_OPTIONS.map((opt) => {
            const active = radiusM === opt.meters;
            return (
              <button
                key={opt.meters}
                role="tab"
                aria-selected={active}
                onClick={() => setRadiusM(opt.meters)}
                disabled={sdkStatus !== "ready"}
                className="font-mono"
                style={{
                  border: "none",
                  borderRadius: "var(--radius-pill)",
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: sdkStatus === "ready" ? "pointer" : "not-allowed",
                  background: active ? "var(--brand)" : "transparent",
                  color: active ? "#FFFFFF" : "var(--text-secondary)",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {/* 반경 탭 묶음과 같은 어두운 톤이면 "따로 떨어진 뱃지"라는 게 한눈에 안 들어와서,
            브랜드 포인트 컬러를 옅게 채운 톤으로 분리했다 */}
        <span
          className="font-mono"
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--brand-hover)",
            background: "rgba(19,81,249,0.16)",
            border: "1px solid rgba(19,81,249,0.4)",
            borderRadius: "var(--radius-pill)",
            padding: "6px 10px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
            whiteSpace: "nowrap",
          }}
        >
          {sdkStatus === "ready" ? (loading ? "검색 중" : fetchError ? "오류" : `${visibleStoresCount}개`) : "·"}
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        role="tablist"
        aria-label="검색 반경"
        style={{
          display: "flex",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid var(--input-border)",
          borderRadius: "var(--radius-pill)",
          padding: 3,
          flex: 1,
        }}
      >
        {RADIUS_OPTIONS.map((opt) => {
          const active = radiusM === opt.meters;
          return (
            <button
              key={opt.meters}
              role="tab"
              aria-selected={active}
              onClick={() => setRadiusM(opt.meters)}
              disabled={sdkStatus !== "ready"}
              className="font-mono"
              style={{
                flex: 1,
                border: "none",
                borderRadius: "var(--radius-pill)",
                padding: "7px 0",
                fontSize: 13,
                fontWeight: 700,
                cursor: sdkStatus === "ready" ? "pointer" : "not-allowed",
                background: active ? "var(--brand)" : "transparent",
                color: active ? "#FFFFFF" : "var(--text-secondary)",
                transition: "background 150ms ease, color 150ms ease",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <span
        className="font-mono"
        style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap" }}
      >
        {sdkStatus === "loading" && "로딩 중"}
        {sdkStatus === "error" && "오류"}
        {sdkStatus === "ready" && (loading ? "검색 중" : fetchError ? "오류" : `${visibleStoresCount}개`)}
      </span>
    </div>
  );
}

/** PC 전용 — 브랜드 패널 카드 안에 들어가는, 위 조각을 전부 합친 완성형. */
export default function SearchControls(props) {
  // 매장종류/브랜드 필터 + 반경 컨트롤은 이제 지도 좌측 상단에 떠 있는 형태로 옮겨가서
  // (모바일과 동일) 사이드바엔 검색 조건(매장명/지역/역) 입력만 남는다. 뒤따르는 구분선은
  // BrandPanel이 결과 리스트 앞에 이미 그려주므로 여기서 또 넣지 않는다.
  return <SearchModeInput {...props} />;
}

const inputStyle = {
  border: "none",
  outline: "none",
  background: "transparent",
  fontSize: 14,
  color: "#191C27",
  width: "100%",
};
