"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import BrandPanel from "./BrandPanel.js";
import SearchControls, { CategoryToggle, SearchModeInput, RadiusControl, BrandToggle } from "./SearchControls.js";
import HamburgerMenu from "./HamburgerMenu.js";
import { PHOTO_BOOTH_BRANDS } from "../lib/photoBoothBrands.js";
import { brandColor } from "../lib/brandColors.js";
import { haversineDistanceMeters } from "../lib/geo.js";

const BRAND_FILTER_OPTIONS = [...PHOTO_BOOTH_BRANDS.map((b) => b.name), "기타"];

// 위치 권한이 없거나 거부됐을 때 쓰는 대체 중심점 — 서울시청(서울 전체를 대표하는 관용적 기준점)
const DEFAULT_CENTER = { lat: 37.5665, lon: 126.978, label: "서울특별시" };
const DEFAULT_RADIUS_M = 5000;
const WALK_SPEED_M_PER_MIN = 67; // 평균 도보 속도 약 4km/h — 직선거리 기준 추정치
const APP_VERSION = "0.1.0"; // package.json과 맞춰둔 값 — PC 사이드바 푸터용 (HamburgerMenu.js에도 동일 상수 있음)
const LAST_UPDATED = "2026.10.09";

function estimateWalkMinutes(distanceM) {
  return Math.max(1, Math.round(distanceM / WALK_SPEED_M_PER_MIN));
}

// 거리/조회수처럼 큰 숫자를 1,697 형태로 — 천 단위 구분 쉼표
function formatNumber(n) {
  return Math.round(n || 0).toLocaleString("ko-KR");
}

// 로드뷰 카메라가 매장을 "바라보게" 돌리기 위한 방위각(0=정북, 시계방향) 계산.
// 파노라마 실제 좌표 -> 매장 좌표 방향을 구해서 Roadview.setViewpoint({pan})에 넘긴다.
function computeBearingDeg(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

// 매장 마커: 원 + 카메라 글리프 (data URI, 외부 이미지 요청 없음). 포토부스는 브랜드별로
// 색이 달라야 해서 고정 문자열이 아니라 색을 받는 함수로 뺐다 — 사진관(단일 색)도 같이 쓴다.
function storeMarkerSvg(color) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
      <circle cx="15" cy="15" r="13" fill="${color}" stroke="#FFFFFF" stroke-width="3"/>
      <rect x="9" y="12" width="12" height="9" rx="2" fill="#FFFFFF"/>
      <rect x="12" y="9" width="6" height="3" rx="1" fill="#FFFFFF"/>
      <circle cx="15" cy="16.5" r="2.6" fill="${color}"/>
    </svg>
  `;
}
const DEFAULT_MARKER_COLOR = "#1351F9";
// 기준점/역 마커: 링+점 모양으로 매장 마커와 확실히 구분
const CENTER_MARKER_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9" fill="#FFFFFF" stroke="#1351F9" stroke-width="3"/>
    <circle cx="12" cy="12" r="3.4" fill="#1351F9"/>
  </svg>
`;

function toDataUri(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// 마커 클릭 시 뜨는 말풍선(CustomOverlay) 내용 — 조회수는 클릭할 때마다 바뀌어서
// (낙관적 +1 또는 서버 응답) 마커 생성 시점 한 번이 아니라 필요할 때마다 다시 호출해서
// infowindow.setContent()로 갱신할 수 있도록 별도 함수로 뺐다.
function buildBubbleContent(store, viewCount) {
  const title = [store.bizesNm, store.brchNm].filter(Boolean).join(" ");
  const address = store.rdnmAdr || store.lnoAdr || "";
  return `
    <div style="margin-bottom:34px;display:flex;flex-direction:column;align-items:center;">
      <div style="padding:11px 13px;font-size:13px;line-height:1.5;max-width:260px;font-family:Pretendard,-apple-system,'Apple SD Gothic Neo',sans-serif;background:var(--surface-1);border-radius:10px;box-shadow:0 8px 20px rgba(0,0,0,0.35);">
        <div style="font-weight:700;color:var(--text-primary);margin-bottom:2px;">${title}</div>
        <div style="color:var(--text-secondary);margin-bottom:7px;">${address}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <span style="display:inline-flex;align-items:center;gap:4px;background:var(--brand);color:#FFFFFF;font-weight:700;border-radius:6px;padding:3px 8px;font-size:12px;white-space:nowrap;">
            현재 위치에서 ${formatNumber(store.distanceM)}m · 도보 ${estimateWalkMinutes(store.distanceM)}분
          </span>
          <span style="display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,0.14);color:#FFFFFF;font-weight:700;border-radius:6px;padding:3px 8px;font-size:12px;white-space:nowrap;">
            조회 ${formatNumber(viewCount)}회
          </span>
        </div>
      </div>
      <div style="width:12px;height:12px;background:var(--surface-1);transform:rotate(45deg);margin-top:-6px;"></div>
    </div>
  `;
}

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

/**
 * "내 근처 가장 가까운 매장" 리스트. 모바일에서는 지도 아래 섹션으로, PC에서는 좌측
 * 사이드바(BrandPanel)의 결과 리스트로 — 같은 컴포넌트를 두 자리에 그대로 재사용한다
 * (네이버지도 데스크톱의 "검색 결과 리스트" 자리 참고).
 */
function NearestStoresList({ sdkStatus, visibleStores, category, onSelectStore, activeCenterLabel, radiusM }) {
  return (
    <div>
      <div
        className="font-mono"
        style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-tertiary)", marginBottom: 6 }}
      >
        {activeCenterLabel.toUpperCase()} · {(radiusM / 1000).toFixed(0)}KM RADIUS
      </div>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>
        내 근처 가장 가까운 {category === "booth" ? "포토부스" : "사진관"}
      </h2>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 16px" }}>
        도보 시간은 직선거리로 추정한 값이라 실제와 다를 수 있어요
      </p>

      {sdkStatus === "ready" && visibleStores.length === 0 && (
        <div
          style={{
            padding: "28px 16px",
            textAlign: "center",
            color: "var(--text-secondary)",
            fontSize: 13,
            background: "var(--surface-1)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          이 근처에는 아직 수집된 {category === "booth" ? "포토부스" : "사진관"} 데이터가 없어요.
        </div>
      )}

      {sdkStatus === "ready" && visibleStores.length > 0 && (
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {visibleStores.slice(0, 5).map((store, idx) => {
            const title = [store.bizesNm, store.brchNm].filter(Boolean).join(" ");
            const address = store.rdnmAdr || store.lnoAdr || "주소 정보 없음";
            const minutes = estimateWalkMinutes(store.distanceM);
            const isTop = idx === 0;
            return (
              <li
                key={store.bizesId}
                role="button"
                tabIndex={0}
                onClick={() => onSelectStore(store)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelectStore(store);
                }}
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start",
                  padding: "14px 16px",
                  background: "var(--surface-1)",
                  borderRadius: "var(--radius-lg)",
                  cursor: "pointer",
                }}
              >
                <span
                  className="font-mono"
                  style={{
                    flexShrink: 0,
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "var(--surface-2)",
                    color: "var(--text-secondary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {idx + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>{title}</span>
                    {isTop && (
                      <span
                        style={{
                          background: "var(--brand)",
                          color: "#FFFFFF",
                          fontSize: 11,
                          fontWeight: 700,
                          borderRadius: "var(--radius-pill)",
                          padding: "2px 9px",
                        }}
                      >
                        가장 가까움
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{address}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <span className="font-mono" style={badgeStyle}>
                      {formatNumber(store.distanceM)}M
                    </span>
                    <span className="font-mono" style={badgeStyle}>
                      도보 {minutes}분
                    </span>
                    <span className="font-mono" style={{ ...badgeStyle, background: "transparent", color: "var(--text-tertiary)" }}>
                      로드뷰 보기 →
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export default function MapViewKakao() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const centerMarkerRef = useRef(null);
  const markersRef = useRef([]);
  const circleRef = useRef(null);
  const markerImageCacheRef = useRef(new Map()); // 색상(hex) -> MarkerImage, 브랜드별 마커 재생성 방지용 캐시
  const geoCenterRef = useRef(null); // geoCenter state를 항상 최신값으로 미러링 — handleSdkLoad 클로저 안에서 참조용
  const geoAppliedRef = useRef(false); // 내 위치로 지도를 "한 번이라도" 옮겼는지 — 그 전환 순간만 애니메이션 없이 즉시 이동
  const openInfoWindowRef = useRef(null); // 현재 열려 있는 말풍선 — 새로 열기 전에 닫는다

  const roadviewContainerRef = useRef(null);
  const roadviewRef = useRef(null);
  const roadviewClientRef = useRef(null);
  const roadviewSectionRef = useRef(null);
  const nearestListSectionRef = useRef(null);
  const [selectedStore, setSelectedStore] = useState(null); // 마커 클릭 시 로드뷰에 띄울 매장
  const [viewCounts, setViewCounts] = useState({}); // { [bizesId]: 서버가 돌려준 최신 조회수 }
  const [roadviewStatus, setRoadviewStatus] = useState("idle"); // idle | checking | available | unavailable
  const [menuOpen, setMenuOpen] = useState(false); // 모바일 햄버거 드로어

  const [sdkStatus, setSdkStatus] = useState("loading"); // loading | ready | error
  const [sdkError, setSdkError] = useState(null);
  const [radiusM, setRadiusM] = useState(DEFAULT_RADIUS_M);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // 접속 시 위치 권한을 요청해서 "본인 위치 기준"으로 기본값을 잡는다
  const [geoCenter, setGeoCenter] = useState(null); // {lat, lon}
  const [geoStatus, setGeoStatus] = useState("idle"); // idle | pending | granted | denied | unsupported

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("unsupported");
      return;
    }

    let cancelled = false;
    let attempt = 0;
    const MAX_ATTEMPTS = 4;

    function requestPosition() {
      setGeoStatus("pending");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          setGeoCenter({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          setGeoStatus("granted");
        },
        (err) => {
          if (cancelled) return;
          attempt += 1;
          // err.code: 1=PERMISSION_DENIED(재시도 의미 없음), 2=POSITION_UNAVAILABLE,
          // 3=TIMEOUT. 권한이 이미 "허용" 상태였던 재방문자는 팝업이 다시 안 뜨니까
          // Permissions API onchange도 안 터진다 — 그런데 PC는 와이파이 기반 위치 측정이
          // 한 번에 안 잡히고 실패/타임아웃 나는 일이 흔해서, 이 경우(1이 아닐 때)는
          // 짧게 쉬었다 몇 번 더 시도한다. 안 그러면 권한 다 허용해놓고도 계속 서울
          // 기본값만 보이는 버그가 생김(실제로 이게 원인이었음).
          if (err.code !== 1 && attempt < MAX_ATTEMPTS) {
            setTimeout(requestPosition, 1500);
            return;
          }
          setGeoStatus("denied");
        },
        // timeout은 브라우저 권한 팝업에 사용자가 응답하는 시간까지 포함한다. 8초는
        // 너무 짧아서, 팝업 보고 고민하다 8초 넘겨 "허용" 누르면 이미 타임아웃으로
        // denied 처리돼버리고 재시도가 없어 "눌러도 반응 없음"처럼 보이는 버그가 있었음.
        { enableHighAccuracy: false, timeout: 20000, maximumAge: 0 }
      );
    }

    requestPosition();

    // 권한이 나중에 "허용"으로 바뀌는 경우(설정에서 변경 등)도 자동으로 한 번 더
    // 시도한다(Permissions API 지원 시) — 위 재시도 로직과는 별개의 트리거.
    let permissionStatus;
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((status) => {
          permissionStatus = status;
          status.onchange = () => {
            if (status.state === "granted") {
              attempt = 0;
              requestPosition();
            }
          };
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
      if (permissionStatus) permissionStatus.onchange = null;
    };
  }, []);

  useEffect(() => {
    geoCenterRef.current = geoCenter;
  }, [geoCenter]);

  // 탭이 백그라운드(다른 앱/탭 전환, 권한 팝업 등)에 있다가 다시 보이면 지도를 강제로
  // 다시 그린다 — 안 그러면 내부 상태(중심 좌표 등)는 바뀌었는데 화면은 그대로인 채로
  // 멈춰 있는 경우가 있다.
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible" && mapRef.current) {
        mapRef.current.relayout();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // 매장 종류: 포토부스(네컷사진류) / 사진관(그 외 사진촬영업) — 기본은 포토부스
  const [category, setCategory] = useState("booth");
  // 포토부스 브랜드 필터 — 사진관엔 브랜드 개념이 없어서 category==="booth"일 때만 쓰인다
  const [brandFilter, setBrandFilter] = useState("");

  // 검색 조건: 내주변/빠른검색/상세검색 3단 구분, 매장명/지역/역 3개 탭 전부 UX상 굳이여서
  // 없앴다 — 입력창 하나(searchQuery)로 매장명/지점명/주소/시도/시군구를 한꺼번에 찾는
  // 서버 통합검색(/api/stores?region=)과 역 자동완성(/api/stations?q=)을 동시에 돌린다.
  // 입력값이 비어 있으면 그 자체로 "필터 없음 = 내 주변 전체"가 되므로 별도 모드가 필요 없다.
  const [searchQuery, setSearchQuery] = useState("");
  const [stationResults, setStationResults] = useState([]);
  const [stationLoading, setStationLoading] = useState(false);
  const [stationError, setStationError] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null); // {name,lat,lon}

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 350);
  // 검색어가 있을 때만 "전국 통합 검색 모드"로 전환(반경 무시) — 단, 역을 이미 선택한
  // 뒤라면 입력창엔 역 이름이 그대로 남아있어도 그건 "역 기준 반경 검색"이지 텍스트
  // 검색이 아니므로 제외한다(선택한 역 좌표 중심으로 반경 원 검색을 계속 써야 함).
  const isSearching = !selectedStation && debouncedSearchQuery.trim().length > 0;

  // "현 지도에서 검색" — 사용자가 지도를 직접 드래그해서 본 위치. 네이버지도처럼, 드래그 후
  // 버튼을 눌러야만 그 위치로 실제 검색이 넘어간다(드래그할 때마다 자동 재검색하지 않음).
  const [searchCenterOverride, setSearchCenterOverride] = useState(null); // {lat, lon} — 버튼 클릭으로 확정된 위치
  const [mapDragCenter, setMapDragCenter] = useState(null); // {lat, lon} — 드래그 직후 실시간 지도 중심(버튼 노출 판단용)

  // 중심 좌표 우선순위: 지도에서 직접 검색(명시적 행동) > 역 선택(명시적 행동) > 내 위치(권한 허용 시) > 기본 위치
  const activeCenter = searchCenterOverride
    ? { lat: searchCenterOverride.lat, lon: searchCenterOverride.lon, label: "이 지역" }
    : selectedStation
    ? { lat: selectedStation.lat, lon: selectedStation.lon, label: selectedStation.name }
    : geoCenter
    ? { lat: geoCenter.lat, lon: geoCenter.lon, label: "내 위치" }
    : DEFAULT_CENTER;

  // 공식 중심(activeCenter)과 멀어질 만큼 드래그했을 때만 "현 지도에서 검색" 버튼을 보여준다
  const showSearchHereButton =
    mapDragCenter != null &&
    haversineDistanceMeters(mapDragCenter.lat, mapDragCenter.lon, activeCenter.lat, activeCenter.lon) > 300;

  // SDK 로드 완료 후 지도 최초 생성
  const handleSdkLoad = () => {
    if (!window.kakao || !window.kakao.maps) {
      setSdkStatus("error");
      setSdkError("window.kakao.maps 를 찾을 수 없습니다.");
      return;
    }
    window.kakao.maps.load(() => {
      try {
        const kakao = window.kakao;
        // SDK 로딩이 느려서 그 사이 위치 권한 허용이 먼저 끝났다면, 서울 기본값을 잠깐
        // 보여줬다가 내 위치로 튀는 대신 처음부터 내 위치로 바로 지도를 띄운다.
        const resolvedGeo = geoCenterRef.current;
        const initialCenter = resolvedGeo ? { lat: resolvedGeo.lat, lon: resolvedGeo.lon } : DEFAULT_CENTER;
        if (resolvedGeo) geoAppliedRef.current = true;

        const map = new kakao.maps.Map(mapContainerRef.current, {
          center: new kakao.maps.LatLng(initialCenter.lat, initialCenter.lon),
          level: 7,
        });
        map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);

        // 사용자가 직접 지도를 드래그했을 때만("dragend"는 프로그램으로 panTo/setCenter할
        // 때는 안 터짐) 실시간 중심을 기록 — "현 지도에서 검색" 버튼 노출 판단에 쓴다.
        kakao.maps.event.addListener(map, "dragend", () => {
          const c = map.getCenter();
          setMapDragCenter({ lat: c.getLat(), lon: c.getLng() });
        });

        centerMarkerRef.current = new kakao.maps.Marker({
          position: new kakao.maps.LatLng(initialCenter.lat, initialCenter.lon),
          map,
          image: new kakao.maps.MarkerImage(toDataUri(CENTER_MARKER_SVG), new kakao.maps.Size(24, 24)),
          zIndex: 10,
        });

        mapRef.current = map;

        if (roadviewContainerRef.current) {
          roadviewRef.current = new kakao.maps.Roadview(roadviewContainerRef.current);
          roadviewClientRef.current = new kakao.maps.RoadviewClient();
        }

        setSdkStatus("ready");
      } catch (err) {
        setSdkStatus("error");
        setSdkError(err.message);
      }
    });
  };

  const handleSdkError = () => {
    setSdkStatus("error");
    setSdkError("카카오맵 SDK 스크립트 로드 실패 (네트워크 또는 도메인 등록 문제일 수 있음)");
  };

  // 역 자동완성: 통합 검색어가 있고 아직 역을 선택하지 않았을 때만 /api/stations 조회
  // (매장명/주소 검색은 /api/stores?region=이 같은 검색어로 별도 처리하므로 여기선
  // 역 이름 매칭만 담당 — 결과가 있으면 드롭다운에 같이 노출된다).
  useEffect(() => {
    if (!debouncedSearchQuery.trim() || selectedStation) {
      setStationResults([]);
      return;
    }
    let cancelled = false;
    setStationLoading(true);
    setStationError(null);

    fetch(`/api/stations?q=${encodeURIComponent(debouncedSearchQuery.trim())}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) setStationError(data.error);
        else setStationResults(data.stations ?? []);
      })
      .catch((err) => !cancelled && setStationError(err.message))
      .finally(() => !cancelled && setStationLoading(false));

    return () => {
      cancelled = true;
    };
  }, [debouncedSearchQuery, selectedStation]);

  // 중심 좌표(기본값 또는 선택한 역)/반경/지역검색어가 바뀔 때마다 /api/stores 재조회.
  // "상세검색 > 지역"에 검색어가 있으면 반경 무시하고 전국 주소 텍스트 검색(region=)으로 전환.
  useEffect(() => {
    if (sdkStatus !== "ready") return;
    setLoading(true);
    setFetchError(null);

    const url = isSearching
      ? `/api/stores?region=${encodeURIComponent(debouncedSearchQuery.trim())}&lat=${activeCenter.lat}&lon=${activeCenter.lon}`
      : `/api/stores?radius=${radiusM}&lat=${activeCenter.lat}&lon=${activeCenter.lon}`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`API 오류: ${res.status}`);
        return res.json();
      })
      .then((data) => setStores(data.stores))
      .catch((err) => setFetchError(err.message))
      .finally(() => setLoading(false));
  }, [radiusM, sdkStatus, activeCenter.lat, activeCenter.lon, isSearching, debouncedSearchQuery]);

  // 지도 중심 마커/뷰를 activeCenter에 맞춰 이동. 서울 기본값 → 내 위치로 처음 바뀌는
  // 순간만 애니메이션 없이 즉시 이동(아무 관련도 없는 먼 거리를 주르륵 이동하는 느낌 방지),
  // 그 외(역 선택 등 사용자 조작)는 기존처럼 부드럽게 panTo.
  useEffect(() => {
    const kakao = window.kakao;
    const map = mapRef.current;
    if (!kakao || !map || !centerMarkerRef.current) return;
    const pos = new kakao.maps.LatLng(activeCenter.lat, activeCenter.lon);
    centerMarkerRef.current.setPosition(pos);

    if (geoCenter && !geoAppliedRef.current) {
      // 브라우저의 실제 위치 권한 팝업이 떠 있는 동안 탭이 백그라운드/비활성 상태였다가
      // 막 허용되는 시점이라, relayout 없이 setCenter만 하면 지도가 내부적으로는 중심이
      // 바뀌었는데 화면에 다시 그려지지 않는 경우가 있었다(실제 기기 재현, 시뮬레이션
      // 권한 허용으로는 안 걸림 — 탭이 안 가려지니까). relayout으로 강제 리드로우 후 이동.
      map.relayout();
      map.setCenter(pos);
      geoAppliedRef.current = true;
    } else {
      map.panTo(pos);
    }
  }, [activeCenter.lat, activeCenter.lon, geoCenter]);

  // 매장 종류(포토부스/사진관) + 브랜드 조건으로 클라이언트 단에서 필터링. 통합 검색어
  // 매칭은 이미 서버(/api/stores?region=)가 매장명/주소/지역 기준으로 걸러서 내려주므로
  // 여기서 다시 텍스트 필터링하지 않는다.
  const visibleStores = useMemo(() => {
    const byCategory = stores.filter((s) => s.type === category);
    return category === "booth" && brandFilter
      ? byCategory.filter((s) => (s.brand || "기타") === brandFilter)
      : byCategory;
  }, [stores, category, brandFilter]);

  // visibleStores/radius 바뀌면 마커/원 갱신
  useEffect(() => {
    if (sdkStatus !== "ready" || !mapRef.current) return;
    const kakao = window.kakao;
    const map = mapRef.current;
    const cache = markerImageCacheRef.current;

    // 브랜드별 MarkerImage를 재사용(캐시)해서, 매장 수가 많아도 색상 개수만큼만 생성한다.
    function getMarkerImage(color) {
      if (!cache.has(color)) {
        cache.set(color, new kakao.maps.MarkerImage(toDataUri(storeMarkerSvg(color)), new kakao.maps.Size(30, 30)));
      }
      return cache.get(color);
    }

    markersRef.current.forEach((m) => m.setMap(null));
    openInfoWindowRef.current?.setMap(null);
    openInfoWindowRef.current = null;

    markersRef.current = visibleStores.map((store) => {
      const color = category === "booth" ? brandColor(store.brand || "기타") : DEFAULT_MARKER_COLOR;
      const marker = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(store.lat, store.lon),
        map,
        image: getMarkerImage(color),
      });
      // 카카오맵/네이버지도 바로가기 버튼은 여기(말풍선) 대신 아래 로드뷰 패널 쪽으로
      // 옮겼다 — 말풍선은 짧게 핵심만, 외부 링크는 상세 정보 영역에 두는 게 자연스러움.
      // kakao.maps.InfoWindow 대신 CustomOverlay를 쓴다 — InfoWindow는 카카오가 자체
      // 프레임으로 감싸서 꼬리(마커와 맞닿는 뾰족한 부분)를 우리 배경색에 맞게 커스텀하기
      // 어렵다. CustomOverlay는 순수 우리 HTML/CSS 그대로 그려줘서 색이 맞는 꼬리를 직접
      // 그릴 수 있다 — margin-bottom으로 마커 높이(30px)만큼 띄워서 꼬리 끝이 마커 바로
      // 위에서 만나도록 하고, 꼬리는 본체와 같은 배경색의 45도 회전 정사각형으로 만든다.
      const infowindow = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(store.lat, store.lon),
        xAnchor: 0.5,
        yAnchor: 1,
        clickable: true,
        content: buildBubbleContent(store, store.viewCount ?? 0),
      });
      // 다른 마커 클릭 시 이전에 열려 있던 말풍선은 닫고 새로 연다. 이미 열려 있는 마커를
      // 다시 클릭하면(토글) 그냥 닫히기만 하고 새로 열지 않는다.
      kakao.maps.event.addListener(marker, "click", () => {
        const wasOpen = openInfoWindowRef.current === infowindow;
        openInfoWindowRef.current?.setMap(null);
        openInfoWindowRef.current = null;
        if (wasOpen) {
          setSelectedStore(null);
          return;
        }
        // 조회수는 이 클릭으로 막 +1될 예정이라 낙관적으로 미리 반영해서 보여준다 —
        // 실제 서버 값은 아래 조회수 증가 useEffect가 비동기로 받아와 viewCounts에
        // 반영하는데, 숫자가 거의 항상 같아서 티 안 남(동시에 같은 매장을 보는 드문
        // 경우만 다름).
        infowindow.setContent(buildBubbleContent(store, (store.viewCount ?? 0) + 1));
        infowindow.setMap(map);
        openInfoWindowRef.current = infowindow;
        setSelectedStore(store);
      });
      return marker;
    });

    if (isSearching) {
      // 전국 통합 검색 모드: 반경 원 대신, 결과가 전부 보이도록 지도 범위를 맞춘다
      circleRef.current?.setMap(null);
      if (visibleStores.length > 0) {
        const bounds = new kakao.maps.LatLngBounds();
        visibleStores.forEach((s) => bounds.extend(new kakao.maps.LatLng(s.lat, s.lon)));
        map.setBounds(bounds);
      }
      return;
    }

    circleRef.current?.setMap(null);
    circleRef.current = new kakao.maps.Circle({
      center: new kakao.maps.LatLng(activeCenter.lat, activeCenter.lon),
      radius: radiusM,
      strokeWeight: 1.5,
      strokeColor: "#1351F9",
      strokeOpacity: 0.45,
      fillColor: "#1351F9",
      fillOpacity: 0.05,
    });
    circleRef.current.setMap(map);
  }, [visibleStores, radiusM, sdkStatus, activeCenter.lat, activeCenter.lon, category, isSearching]);

  // 매장이 선택될 때마다(마커 클릭이든 사이드바 리스트 클릭이든 — 둘 다 selectedStore를
  // 바꾸는 진입점이라 여기 하나로 통일) 스트릿뷰 상세가 열리는 셈이니 조회수를 1 증가시킨다.
  // 서버가 돌려준 최신값을 viewCounts에 저장해서 로드뷰 패널과 마커 말풍선 둘 다 반영한다.
  useEffect(() => {
    if (!selectedStore?.bizesId) return;
    const bizesId = selectedStore.bizesId;
    let cancelled = false;
    fetch(`/api/stores/${encodeURIComponent(bizesId)}/view`, { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || typeof data.viewCount !== "number") return;
        setViewCounts((prev) => ({ ...prev, [bizesId]: data.viewCount }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedStore]);

  // 선택된 매장이 바뀌면 그 좌표 근처에서 가장 가까운 로드뷰 패노라마를 찾아 띄운다
  useEffect(() => {
    const kakao = window.kakao;
    const roadview = roadviewRef.current;
    const client = roadviewClientRef.current;
    if (!selectedStore || !kakao || !roadview || !client) return;

    setRoadviewStatus("checking");
    const position = new kakao.maps.LatLng(selectedStore.lat, selectedStore.lon);
    client.getNearestPanoId(position, 50, (panoId) => {
      if (panoId === null) {
        setRoadviewStatus("unavailable");
        return;
      }

      // "init" 이벤트는 Roadview 객체가 "최초" 초기화될 때 딱 한 번만 발화한다(실측 확인).
      // 두 번째 매장부터는 setPanoId를 다시 불러도 init이 재발화하지 않아서, 로드뷰 자체는
      // 정상적으로 바뀌는데 "로드뷰 확인 중..." 오버레이만 영원히 안 걷히는 버그가 있었음
      // — 이게 "두 번째부터 너무 오래 걸린다"로 보였던 원인. position_changed는 setPanoId를
      // 부를 때마다 매번 재발화하는 걸 확인해서 이걸로 교체.
      function onPositionChanged() {
        kakao.maps.event.removeListener(roadview, "position_changed", onPositionChanged);
        const panoPos = roadview.getPosition();
        if (panoPos) {
          const pan = computeBearingDeg(panoPos.getLat(), panoPos.getLng(), selectedStore.lat, selectedStore.lon);
          roadview.setViewpoint({ pan, tilt: 0, zoom: -1 }); // zoom 0은 너무 확대되어 보여서 한 단계 축소
        }
        setRoadviewStatus("available");
      }
      kakao.maps.event.addListener(roadview, "position_changed", onPositionChanged);
      roadview.setPanoId(panoId, position);
    });

    roadviewSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedStore]);

  const recenter = () => {
    const kakao = window.kakao;
    const map = mapRef.current;
    if (!kakao || !map) return;
    // 열려 있던 마커 말풍선/선택 상태도 같이 정리 — 안 그러면 기준 위치로 돌아가도
    // 전에 클릭했던 매장 말풍선이 그대로 떠 있었다
    openInfoWindowRef.current?.setMap(null);
    openInfoWindowRef.current = null;
    setSelectedStore(null);
    // "현 지도에서 검색"으로 잡아둔 임시 기준점 + 선택해둔 역 기준점도 같이 해제 —
    // "내주변" 탭이 없어진 대신, 이 버튼이 "진짜 내 위치로 돌아가기" 역할을 전담한다.
    setSearchCenterOverride(null);
    setMapDragCenter(null);
    setSelectedStation(null);
    setSearchQuery("");
    setStationResults([]);
    // activeCenter는 다음 렌더에야 재계산되니, 여기서는 geoCenter/DEFAULT를 직접
    // 계산해서 지도만 먼저 옮겨준다(역 기준점은 방금 지웠으니 더 이상 고려 안 함).
    const fallback = geoCenter ? { lat: geoCenter.lat, lon: geoCenter.lon } : DEFAULT_CENTER;
    map.setCenter(new kakao.maps.LatLng(fallback.lat, fallback.lon));
    map.setLevel(7);
  };

  const pickStation = (station) => {
    setSearchCenterOverride(null); // 역 선택도 명시적인 "여기로" 행동 — 지도 드래그 임시 기준점은 해제
    setMapDragCenter(null);
    setSelectedStation(station);
    setSearchQuery(station.name);
    setStationResults([]);
  };

  // "현 지도에서 검색" 버튼 클릭 — 드래그로 본 위치를 실제 검색 기준으로 확정한다
  const searchInCurrentMap = () => {
    if (!mapDragCenter) return;
    setSearchCenterOverride(mapDragCenter);
    setMapDragCenter(null);
  };

  const clearStation = () => {
    setSelectedStation(null);
    setSearchQuery("");
    setStationResults([]);
  };

  const searchControlsProps = {
    geoStatus,
    defaultCenterLabel: DEFAULT_CENTER.label,
    category,
    setCategory,
    brandFilter,
    setBrandFilter,
    brandOptions: BRAND_FILTER_OPTIONS,
    searchQuery,
    setSearchQuery,
    stationResults,
    stationLoading,
    stationError,
    selectedStation,
    setSelectedStation,
    pickStation,
    clearStation,
    radiusM,
    setRadiusM,
    sdkStatus,
    loading,
    fetchError,
    visibleStoresCount: visibleStores.length,
  };

  return (
    <div className="page-shell">
      <div className="app-frame">
        {/* 예전엔 로드뷰/리스트가 이 안에 같이 있어서 minHeight:100vh로 전체 화면을
            채웠지만, 지금은 로드뷰가 형제 섹션(.roadview-panel)으로 빠져나가서 이 div엔
            상단바+지도만 남는다. minHeight:100vh를 그대로 두면 그 내용(~130px 부족분)만큼
            빈 여백이 지도 밑에 생겨서 뺐다 — 내용(상단바+지도) 높이만큼만 차지하면 된다. */}
        <div style={{ display: "flex", flexDirection: "column", background: "var(--canvas)" }}>
          {/* 모바일 전용 상단 고정바 — 네이버지도 구조 참고 (로고+햄버거 줄, 그 아래 검색줄).
              PC에서는 숨기고 좌측 브랜드 패널 것만 쓴다. */}
          <div className="mobile-only" style={{ background: "var(--surface-1)", borderBottom: "1px solid var(--divider)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "9px 14px 7px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <img src="/brand/mark.svg" alt="" width={22} height={22} style={{ borderRadius: 6, flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>픽처히어</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto" }}>
                <button
                  onClick={() => setMenuOpen(true)}
                  aria-label="메뉴 열기"
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--text-primary)",
                    width: 28,
                    height: 28,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
            <div style={{ padding: "0 14px 8px" }}>
              <SearchModeInput {...searchControlsProps} />
            </div>
          </div>

          {/* 모바일: 640px(또는 화면의 66%) 고정 높이로 스크롤 아래 로드뷰/리스트가 이어짐.
              PC: map-fill-desktop 클래스가 100%로 덮어써서 사이드바 옆 지도가 뷰포트를
              꽉 채운다(네이버지도 구조) — globals.css 참고. */}
          <div className="map-fill-desktop" style={{ position: "relative", width: "100%", height: "min(640px, 66vh)", flexShrink: 0 }}>
            <Script
              src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false`}
              strategy="afterInteractive"
              onLoad={handleSdkLoad}
              onError={handleSdkError}
            />

            {/* 지도 위에 떠 있는 매장종류/브랜드 선택, 같은 줄로 좌측 상단 배치
                (네이버지도의 "일반/위성" 토글 자리 참고). PC/모바일 공통 — PC도 지도
                영역 안으로 옮겨서 사이드바는 검색/결과 리스트만 남는다. */}
            <div style={{ position: "absolute", top: 16, left: 16, zIndex: 1000 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <CategoryToggle category={category} setCategory={setCategory} variant="select" />
                {/* 브랜드 필터 — 포토부스를 고르고 있을 때만 의미가 있어서 그때만 보여준다 */}
                {category === "booth" && (
                  <BrandToggle brand={brandFilter} setBrand={setBrandFilter} options={BRAND_FILTER_OPTIONS} />
                )}
                {/* 반경(3/5/10km)+결과 개수 — PC 전용. 모바일은 엄지존(좌측 하단)에 따로 떠 있어서
                    여기서는 숨긴다(globals.css .pc-only). */}
                <div className="pc-only">
                  <RadiusControl
                    radiusM={radiusM}
                    setRadiusM={setRadiusM}
                    sdkStatus={sdkStatus}
                    loading={loading}
                    fetchError={fetchError}
                    visibleStoresCount={visibleStores.length}
                    variant="pill"
                  />
                </div>
              </div>
            </div>

            {/* 반경(3/5/10km)+결과 개수 — 지도 기준 좌측 하단 플로팅. 모바일 전용 */}
            <div className="mobile-only" style={{ position: "absolute", left: 16, bottom: 24, zIndex: 1000 }}>
              <RadiusControl
                radiusM={radiusM}
                setRadiusM={setRadiusM}
                sdkStatus={sdkStatus}
                loading={loading}
                fetchError={fetchError}
                visibleStoresCount={visibleStores.length}
                variant="pill"
              />
            </div>

            {/* "현 지도에서 검색" — 네이버지도 참고. 공식 기준점(activeCenter)과 멀어질 만큼
                드래그했을 때만 뜬다. 드래그마다 자동 재검색하지 않고, 눌러야만 그 위치로
                검색이 넘어간다. PC/모바일 공통, 지도 하단 중앙 */}
            {showSearchHereButton && (
              <div style={{ position: "absolute", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 1000 }}>
                <button
                  onClick={searchInCurrentMap}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    border: "none",
                    background: "var(--brand)",
                    color: "#FFFFFF",
                    fontSize: 13,
                    fontWeight: 700,
                    borderRadius: "var(--radius-pill)",
                    padding: "10px 18px",
                    cursor: "pointer",
                    boxShadow: "0 6px 20px rgba(19,81,249,0.45)",
                    whiteSpace: "nowrap",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M4 12a8 8 0 0 1 13.66-5.66M20 12a8 8 0 0 1-13.66 5.66M18 3v4h-4M6 21v-4h4"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  이 지역에서 재검색
                </button>
              </div>
            )}

            {/* 기준점 재중심 버튼 — 지도 기준 우측 하단, 엄지 닿는 자리. PC/모바일 공통으로 노출.
                실제 내 위치를 못 쓰고 있을 땐(권한 거부/확인 중 등) 색을 죽여서 "지금 기준점이
                내 위치가 아니다"를 한눈에 알 수 있게 했다 — 전에는 실패해도 평소와 똑같아 보여서
                사용자가 원인을 알 길이 없었다. */}
            <div style={{ position: "absolute", right: 16, bottom: 24, zIndex: 1000 }}>
              <button
                onClick={recenter}
                disabled={sdkStatus !== "ready"}
                aria-label="기준 위치로 이동"
                title={
                  geoStatus === "granted"
                    ? "기준 위치로 이동 (내 위치)"
                    : geoStatus === "pending"
                    ? "내 위치 확인 중..."
                    : geoStatus === "denied"
                    ? "내 위치를 가져오지 못했어요 (브라우저 위치 권한을 확인해주세요) — 기준 위치로 이동"
                    : "위치 정보를 지원하지 않는 환경이에요 — 기준 위치로 이동"
                }
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  border: "none",
                  background: "var(--surface-2)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                  cursor: sdkStatus === "ready" ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {(() => {
                  const geoColor = geoStatus === "granted" ? "var(--brand)" : "var(--text-tertiary)";
                  return (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="3" fill={geoColor} />
                      <circle cx="12" cy="12" r="8" stroke={geoColor} strokeWidth="1.6" />
                      <path d="M12 1v4M12 19v4M1 12h4M19 12h4" stroke={geoColor} strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  );
                })()}
              </button>
            </div>

            {sdkStatus === "error" && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--canvas)",
                  color: "var(--text-secondary)",
                  fontSize: 14,
                  padding: 24,
                  textAlign: "center",
                }}
              >
                지도를 불러오지 못했습니다: {sdkError}
              </div>
            )}

            <div ref={mapContainerRef} style={{ width: "100%", height: "100%", background: "var(--canvas)" }} />
          </div>
        </div>
      </div>

      {/* PC 사이드바 전체(검색헤더+결과리스트+로드뷰+푸터)를 하나의 연속 스크롤로 묶는
          래퍼 — globals.css .sidebar-scroll이 모바일에선 display:contents라 아래
          자식들이 각자 CSS대로(브랜드패널/PC리스트는 숨김, 로드뷰는 지도 바로 밑에)
          그대로 문서 흐름에 놓이고, PC에서만 실제 스크롤 컨테이너가 된다. */}
      <div className="sidebar-scroll">
        {/* PC 전용 좌측 상단 — 검색 조건 UI가 이 안에 도킹되고, 스크롤해도 맨 위에 고정된다 */}
        <BrandPanel>
          <SearchControls {...searchControlsProps} />
        </BrandPanel>

        {/* PC 전용 결과 리스트 — 모바일은 지도 밑 별도 섹션(아래 .mobile-only)에서 같은
            컴포넌트를 독립적으로 또 렌더링한다(두 리스트는 서로 다른 React 엘리먼트라
            로드뷰와 달리 "DOM 하나 공유" 제약이 없음). */}
        <div className="pc-only" style={{ padding: "16px 20px" }}>
          <NearestStoresList
            sdkStatus={sdkStatus}
            visibleStores={visibleStores}
            category={category}
            onSelectStore={setSelectedStore}
            activeCenterLabel={activeCenter.label}
            radiusM={radiusM}
          />
        </div>

        {/* 로드뷰 패널 — 카카오 로드뷰는 DOM 하나에 묶이는 위젯이라 두 군데에 동시에
            그릴 수 없어서, 같은 엘리먼트 하나를 CSS로 breakpoint별 위치만 바꾼다:
            모바일은 지도 바로 아래(.sidebar-scroll이 display:contents라 제자리),
            PC는 좌측 사이드바 스크롤 안, 리스트 바로 밑. */}
        <section ref={roadviewSectionRef} className="roadview-panel">
          <div
            className="font-mono"
            style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-tertiary)", marginBottom: 6 }}
          >
            STREET VIEW
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>
            {selectedStore ? [selectedStore.bizesNm, selectedStore.brchNm].filter(Boolean).join(" ") : "매장 로드뷰"}
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 10px" }}>
            {selectedStore
              ? selectedStore.rdnmAdr || selectedStore.lnoAdr || ""
              : "지도에서 마커를 클릭하면 이 위치의 로드뷰를 보여드려요."}
          </p>

          {/* 거리/도보시간/조회수 — "현재 위치에서"를 명시해서 기준점이 뭔지 분명하게 하고,
              조회수는 selectedStore가 바뀔 때마다 아래 useEffect가 증가시킨 최신값을
              viewCounts에서 읽는다(응답 오기 전까진 +1 낙관값으로 보여줘서 깜빡임 방지). */}
          {selectedStore && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "0 0 14px" }}>
              <span className="font-mono" style={badgeStyle}>
                현재 위치에서 {formatNumber(selectedStore.distanceM)}m · 도보 {estimateWalkMinutes(selectedStore.distanceM)}분
              </span>
              <span className="font-mono" style={badgeStyle}>
                조회 {formatNumber(viewCounts[selectedStore.bizesId] ?? (selectedStore.viewCount ?? 0) + 1)}회
              </span>
            </div>
          )}

          {/* 외부 지도에서 같은 매장명으로 바로 검색되는 결과 페이지 링크 — 각 서비스 CI
              컬러로 버튼 구분(카카오 옐로우/네이버 그린), 둘 다 실제 접속해서 검색결과
              뜨는 것까지 확인함. 말풍선 대신 여기(로드뷰 상세 영역)에 둔다. */}
          {selectedStore &&
            (() => {
              const mapQuery = encodeURIComponent(
                [selectedStore.bizesNm, selectedStore.brchNm].filter(Boolean).join(" ")
              );
              const kakaoMapUrl = `https://map.kakao.com/?q=${mapQuery}`;
              const naverMapUrl = `https://map.naver.com/p/search/${mapQuery}`;
              return (
                <div style={{ display: "flex", gap: 6, margin: "0 0 14px" }}>
                  <a
                    href={kakaoMapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1,
                      textAlign: "center",
                      background: "#FEE500",
                      color: "#191919",
                      fontWeight: 700,
                      fontSize: 12,
                      borderRadius: 6,
                      padding: "8px 0",
                      textDecoration: "none",
                    }}
                  >
                    카카오맵에서 보기
                  </a>
                  <a
                    href={naverMapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1,
                      textAlign: "center",
                      background: "#03C75A",
                      color: "#FFFFFF",
                      fontWeight: 700,
                      fontSize: 12,
                      borderRadius: 6,
                      padding: "8px 0",
                      textDecoration: "none",
                    }}
                  >
                    네이버지도에서 보기
                  </a>
                </div>
              );
            })()}

          <div className="roadview-canvas-wrap">
            <div ref={roadviewContainerRef} style={{ width: "100%", height: "100%" }} />

            {(!selectedStore || roadviewStatus === "checking" || roadviewStatus === "unavailable") && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-secondary)",
                  fontSize: 13,
                  textAlign: "center",
                  padding: 24,
                  background: "rgba(10,14,26,0.9)",
                }}
              >
                {!selectedStore && "지도에서 매장 마커를 클릭해보세요"}
                {selectedStore && roadviewStatus === "checking" && "로드뷰 확인 중..."}
                {selectedStore && roadviewStatus === "unavailable" && "이 위치는 로드뷰를 제공하지 않아요."}
              </div>
            )}
          </div>
        </section>

        {/* 조용한 정보 푸터(반경/출처/버전) — PC 사이드바 스크롤의 진짜 맨 아래에만 보인다.
            모바일은 햄버거 메뉴 안에 같은 내용이 이미 있어서 숨김(globals.css). */}
        <div className="sidebar-footer">
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.7, margin: 0 }}>
            검색 반경 {(radiusM / 1000).toFixed(0)}km · 공공데이터포털 · 카카오맵
            <br />
            도보 시간은 직선거리 기준 추정치예요
            <br />v{APP_VERSION} · {LAST_UPDATED} 업데이트
          </p>
        </div>
      </div>

      {/* 지도 아래 — 내 근처 가장 가까운 매장. PC에서는 같은 리스트를 좌측 사이드바
          (.sidebar-scroll 안의 pc-only 블록)에 따로 렌더링하므로, 여긴 모바일 전용으로 숨긴다. */}
      <section ref={nearestListSectionRef} className="mobile-only" style={{ padding: "36px 20px 56px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <NearestStoresList
            sdkStatus={sdkStatus}
            visibleStores={visibleStores}
            category={category}
            onSelectStore={setSelectedStore}
            activeCenterLabel={activeCenter.label}
            radiusM={radiusM}
          />
        </div>
      </section>

      <HamburgerMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        radiusM={radiusM}
      />
    </div>
  );
}

const badgeStyle = {
  display: "inline-block",
  background: "rgba(255,255,255,0.10)",
  color: "var(--text-primary)",
  fontWeight: 600,
  fontSize: 12,
  borderRadius: "var(--radius-pill)",
  padding: "4px 11px",
};
