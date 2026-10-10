/**
 * storeApi.js
 * ============
 * 소상공인시장진흥공단 상가(상권)정보 API의 "반경 내 상가업소 조회"
 * (storeListInRadius) 엔드포인트를 감싼 순수 로직 모듈.
 *
 * Node.js 단독 스크립트(scripts/fetchStores.js)와 Next.js 프로젝트
 * (API Route, Server Action, Server Component 등) 양쪽에서 그대로
 * import 해서 재사용할 수 있도록, 파일 시스템(csv 저장)이나 .env 로딩 같은
 * 환경 종속적인 코드는 포함하지 않는다. 서비스키는 항상 호출하는 쪽에서
 * 파라미터로 넘겨준다 (서버 전용 값이므로 NEXT_PUBLIC_* 로 노출하지 말 것).
 */

import { isKnownBrandStore } from "./photoBoothBrands.js";

export const API_URL = "https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius";

// 포토부스(즉석사진) 관련 매장을 걸러낼 키워드 (상호명/지점명 어디에든 포함되면 매칭).
// "포토"/"photo"는 뺐다 — 전국 데이터 기준 "포토프라자"/"비알포토"/"동방포토"처럼 그냥
// 상호에 "포토"가 들어간 일반 동네 사진관(studio)이 수두룩해서 booth로 오분류됨.
// "네컷"/"4컷"은 즉석사진 포맷 자체를 가리키는 말이라 일반 사진관이 쓸 일이 거의 없어 남겨둠.
// "인생"은 단독으로 쓰면 "인생아구찜"/"인생건어물" 같은 식당·주점 상호에 대거 걸려서
// (10km 반경 검증 결과 132건 중 130건이 오탐) 브랜드 풀네임 "인생네컷"으로 좁혔다.
// 그 외 특정 브랜드명(포토이즘/셀픽스/무피 등, "포토"/"네컷" 안 들어간 것 포함)은
// photoBoothBrands.js의 matchKnownBrand가 별도로 잡아준다 — classifyStoreType에서 같이 씀.
export const PHOTO_BOOTH_KEYWORDS = ["네컷", "4컷", "인생네컷", "하루필름"];

// 업종 소분류 코드: 사진촬영업
export const PHOTO_STUDIO_INDS_SCLS_CD = "M11301";

const DEFAULT_NUM_OF_ROWS = 1000;

/**
 * 한 페이지(pageNo)를 호출해서 JSON을 반환한다.
 *
 * @param {object} params
 * @param {string} params.serviceKey - 공공데이터포털 서비스키 (Decoding 키 권장)
 * @param {string|number} params.cx - 중심점 경도
 * @param {string|number} params.cy - 중심점 위도
 * @param {string|number} params.radius - 반경(m)
 * @param {number} params.pageNo - 페이지 번호 (1부터 시작)
 * @param {number} [params.numOfRows] - 한 페이지당 행 수 (최대 1000, 공식 상한)
 * @returns {Promise<object>} API 응답 JSON (header/body 포함)
 */
export async function fetchStorePage({
  serviceKey,
  cx,
  cy,
  radius,
  pageNo,
  numOfRows = DEFAULT_NUM_OF_ROWS,
  indsSclsCd,
}) {
  if (!serviceKey) {
    throw new Error("serviceKey가 비어 있습니다. DATA_GO_KR_SERVICE_KEY 환경변수를 확인하세요.");
  }

  const url = new URL(API_URL);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("cy", cy);
  url.searchParams.set("radius", radius);
  url.searchParams.set("type", "json");
  url.searchParams.set("numOfRows", String(numOfRows));
  url.searchParams.set("pageNo", String(pageNo));
  // 업종 소분류 코드로 서버 단에서 필터링 — 전국 단위로 돌릴 때 불필요한 업종을
  // 받아오지 않도록(트래픽/호출수 절감) 반경별 조회 API가 지원하는 선택 파라미터.
  if (indsSclsCd) url.searchParams.set("indsSclsCd", indsSclsCd);

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`[오류] pageNo=${pageNo} HTTP ${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(
      `[오류] pageNo=${pageNo} 응답이 JSON이 아닙니다. 서비스키가 올바른지 확인하세요.\n` +
        `응답 내용 일부: ${text.slice(0, 300)}`
    );
  }

  const data = await res.json();

  const resultCode = String(data?.header?.resultCode ?? "");
  // NODATA_ERROR(03) — 해당 조회 조건(좌표/업종)에 매칭되는 데이터가 없다는 뜻이지
  // 호출 자체가 실패한 게 아니다 (바다 위 격자 포인트 등에서 흔히 발생). totalCount 0인
  // 정상 응답으로 취급해야, 격자 크롤링 중 빈 지점을 "실패"로 오인해 영구 재시도하지 않는다.
  if (resultCode === "03") {
    return { header: data.header, body: { totalCount: 0, items: [] } };
  }
  if (resultCode && !["00", "0"].includes(resultCode)) {
    throw new Error(
      `[API 오류] pageNo=${pageNo} resultCode=${resultCode} resultMsg=${data?.header?.resultMsg}`
    );
  }

  return data;
}

/**
 * totalCount를 확인하면서 pageNo=1부터 끝까지 돌며 모든 상가 데이터를 모은다.
 *
 * @param {object} params
 * @param {string} params.serviceKey
 * @param {string|number} params.cx
 * @param {string|number} params.cy
 * @param {string|number} params.radius
 * @param {number} [params.numOfRows]
 * @param {(info: {pageNo: number, pageItemCount: number, collected: number, totalCount: number}) => void} [params.onProgress]
 *        페이지를 받아올 때마다 진행 상황을 전달받는 콜백 (CLI 로그 출력, Next.js 쪽 스트리밍 등에 사용)
 * @returns {Promise<object[]>} 수집된 전체 매장 아이템 배열
 */
export async function fetchAllStores({
  serviceKey,
  cx,
  cy,
  radius,
  numOfRows = DEFAULT_NUM_OF_ROWS,
  indsSclsCd,
  onProgress,
}) {
  const allItems = [];
  let pageNo = 1;
  let totalCount = null;

  while (true) {
    const data = await fetchStorePage({ serviceKey, cx, cy, radius, pageNo, numOfRows, indsSclsCd });
    const body = data?.body ?? {};

    if (totalCount === null) {
      totalCount = Number(body.totalCount ?? 0);
    }

    let items = body.items ?? [];
    // 매장이 1건만 있을 때 items가 배열이 아니라 객체로 오는 경우 방어
    if (items && !Array.isArray(items)) {
      items = [items];
    }

    allItems.push(...items);

    onProgress?.({
      pageNo,
      pageItemCount: items.length,
      collected: allItems.length,
      totalCount,
    });

    if (items.length === 0 || allItems.length >= totalCount) {
      break;
    }

    pageNo += 1;
  }

  return allItems;
}

/** 상호명(bizesNm)/지점명(brchNm)에 PHOTO_BOOTH_KEYWORDS 중 하나라도 포함되는지. */
export function nameMatchesPhotoBoothKeyword(item) {
  const bizName = item?.bizesNm ?? "";
  const branchName = item?.brchNm ?? "";
  const combinedName = `${bizName} ${branchName}`.toLowerCase();
  return PHOTO_BOOTH_KEYWORDS.some((keyword) => combinedName.includes(keyword.toLowerCase()));
}

/**
 * 상호명(bizesNm) 또는 지점명(brchNm)에 PHOTO_BOOTH_KEYWORDS 중 하나라도 포함되거나,
 * 업종 소분류 코드(indsSclsCd)가 사진촬영업(M11301)이면 true.
 */
export function isPhotoBoothStore(item) {
  const categoryMatched = item?.indsSclsCd === PHOTO_STUDIO_INDS_SCLS_CD;
  return nameMatchesPhotoBoothKeyword(item) || categoryMatched;
}

/** items 중 포토부스/사진촬영업 매장만 추려낸다. */
export function filterPhotoBoothStores(items) {
  return items.filter(isPhotoBoothStore);
}

/**
 * "포토부스"(네컷사진류 브랜드 느낌 이름) vs "사진관"(업종코드만 일치, 전통적/개인 사진관
 * 이름)으로 2분류한다. isPhotoBoothStore로 이미 걸러진 매장에만 의미가 있다 — 상호명에
 * 키워드가 있으면 booth, 없으면(=업종코드로만 들어온 경우) studio.
 * @returns {"booth"|"studio"}
 */
export function classifyStoreType(item) {
  return nameMatchesPhotoBoothKeyword(item) || isKnownBrandStore(item) ? "booth" : "studio";
}

/**
 * indsSclsCd/indsSclsNm(업종 소분류 코드/명) 기준으로 매장 수를 집계한다.
 * @returns {{indsSclsCd: string, indsSclsNm: string, storeCount: number}[]} 매장 수 내림차순
 */
export function summarizeByCategory(items) {
  // 업종 소분류 코드(indsSclsCd)를 1차 키로 쓰고, 코드가 비어있을 때만
  // 소분류명(indsSclsNm)으로 구분한다 (코드-명은 1:1 매핑이라고 가정).
  const counts = new Map(); // key -> { indsSclsCd, indsSclsNm, storeCount }

  for (const item of items) {
    const code = item?.indsSclsCd ?? "";
    const name = item?.indsSclsNm ?? "(미분류)";
    const key = code || `name:${name}`;

    const existing = counts.get(key);
    if (existing) {
      existing.storeCount += 1;
    } else {
      counts.set(key, { indsSclsCd: code, indsSclsNm: name, storeCount: 1 });
    }
  }

  return Array.from(counts.values()).sort((a, b) => b.storeCount - a.storeCount);
}
