/**
 * brandColors.js
 * ===============
 * 브랜드 이름 -> 색상(hex) 매핑. 브랜드 수가 늘어나도 수동으로 색을 안 늘려도 되게,
 * 이름을 해시해서 고정 팔레트에서 고른다(같은 브랜드는 항상 같은 색).
 * 어드민 매장 관리(브랜드 뱃지)와 공개 지도(마커 색) 양쪽에서 같은 색을 쓰도록 공용으로 뺐다.
 */

export const BRAND_PALETTE = [
  "#FF6B9D",
  "#6B9DFF",
  "#FFB86B",
  "#4FD69C",
  "#C86BFF",
  "#E5D23F",
  "#45D4E5",
  "#FF7A7A",
  "#A3E635",
  "#FF6BC8",
  "#3FE5C2",
  "#FFA14F",
  "#8C9CFF",
  "#F2789A",
];

export const UNKNOWN_BRAND_COLOR = "#8b93a7";

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** 브랜드명(또는 falsy/"기타")에 대응하는 hex 색을 반환한다. */
export function brandColor(brand) {
  if (!brand || brand === "기타") return UNKNOWN_BRAND_COLOR;
  return BRAND_PALETTE[hashString(brand) % BRAND_PALETTE.length];
}
