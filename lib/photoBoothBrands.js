/**
 * photoBoothBrands.js
 * =====================
 * 국내 즉석사진(네컷사진) 프랜차이즈 브랜드 목록.
 *
 * 출처: 공정거래위원회 가맹사업거래 정보공개시스템 공시자료(2024.10 기준 가맹점수)
 * 및 업계 소개 기사(2026.10 웹 검색) 종합. 상호명에 "포토"/"네컷" 등 공통 키워드가
 * 없는 브랜드도 많아(무피, 모노맨션, 셀픽스 등), storeApi.js의 느슨한 키워드 필터만으로는
 * 잡히지 않는다. 이 목록은 그 보완/교차검증용이다.
 *
 * 주의: 이 목록은 웹 검색 시점 기준이며 100% 전수조사가 아니다. 소규모 신생/지역
 * 브랜드가 빠져 있을 수 있으니, 실제 서비스에 쓸 때는 주기적으로 갱신 필요.
 */

export const PHOTO_BOOTH_BRANDS = [
  // 주요 4대 브랜드 (공정위 공시 가맹점수 기준, 2024.10)
  { name: "인생네컷", franchiseStores: 374 },
  { name: "포토이즘", franchiseStores: 369 }, // 포토이즘박스, 포토이즘컬러드 등 서브 브랜드 포함
  { name: "포토시그니처", franchiseStores: 206 },
  { name: "하루필름", franchiseStores: 116 },

  // 기타 브랜드 (가맹점수 미상)
  { name: "포토그레이" },
  { name: "체리포토" },
  { name: "무피" },
  { name: "무드팔레트" },
  { name: "돈룩업" },
  { name: "그믐달" }, // 그믐달 셀프 스튜디오
  { name: "나랑한컷" },
  { name: "비룸스튜디오" },
  { name: "마이포토부스" },
  { name: "미라트스튜디오" },
  { name: "모노맨션" },
  { name: "셀픽스" },
  { name: "썸컷" },
  { name: "스냅치즈" },
  { name: "스위치 스튜디오" },
  { name: "인싸포토" },
  { name: "팡팡스튜디오" },
  { name: "포토스트리트" },
  { name: "포토매틱" },
  { name: "플레이인더박스" },
  { name: "헬로포토" },
  { name: "픽닷" },
  { name: "올드문스튜디오" },
  { name: "오디티모드" },

  // 2026.10 4cutmap.com 브랜드 필터 대조 보강분
  { name: "플랜비스튜디오" },
  { name: "앵글360" },
  { name: "필름한잔" },
  { name: "시현하다모먼트" },
  { name: "컨셉티드" },
];

// "무피", "썸컷"처럼 2글자인 브랜드명은 다른 단어 안에 우연히 포함되기 쉽다
// (예: "무피" → "나무피아노교습소"). 이런 짧은 이름은 업종이 실제로 사진 관련일 때만 인정한다.
const SHORT_BRAND_NAME_LENGTH = 2;

function isPhotoRelatedCategory(item) {
  const text = `${item?.indsLclsNm ?? ""} ${item?.indsMclsNm ?? ""} ${item?.indsSclsNm ?? ""}`;
  return item?.indsSclsCd === "M11301" || text.includes("사진");
}

function normalizeForMatch(s) {
  return (s ?? "").replace(/\s+/g, "");
}

/**
 * 상호명(bizesNm) 또는 지점명(brchNm)이 알려진 브랜드명을 포함하는지 확인한다.
 * 공백 유무 표기 차이("포토 그레이" vs "포토그레이")는 무시하고 비교한다.
 * 매칭된 브랜드명(들)을 함께 반환해서 어떤 브랜드로 잡혔는지 추적할 수 있게 한다.
 */
export function matchKnownBrand(item) {
  const bizName = item?.bizesNm ?? "";
  const branchName = item?.brchNm ?? "";
  const combined = normalizeForMatch(`${bizName}${branchName}`);

  const matched = PHOTO_BOOTH_BRANDS.filter((brand) => {
    if (!combined.includes(normalizeForMatch(brand.name))) return false;
    if (brand.name.length <= SHORT_BRAND_NAME_LENGTH && !isPhotoRelatedCategory(item)) {
      return false; // 짧은 브랜드명은 업종이 사진 관련일 때만 인정
    }
    return true;
  });
  return matched.map((b) => b.name);
}

/**
 * 매장 1건에 브랜드 라벨 하나를 매긴다 (어드민 브랜드 필터/DB brand 컬럼용).
 * 여러 브랜드가 동시에 매칭되면(드묾) 이름이 더 긴 쪽 — 더 구체적인 쪽을 우선한다.
 * 매칭 없으면 "기타"를 반환한다 (포토부스인데 알려진 프랜차이즈가 아닌 경우).
 */
export function pickBrandLabel(item) {
  const matches = matchKnownBrand(item);
  if (matches.length === 0) return "기타";
  return matches.sort((a, b) => b.length - a.length)[0];
}

export function isKnownBrandStore(item) {
  return matchKnownBrand(item).length > 0;
}

/** items 중 알려진 브랜드명과 매칭되는 매장만 추려낸다. */
export function filterKnownBrandStores(items) {
  return items.filter(isKnownBrandStore);
}
