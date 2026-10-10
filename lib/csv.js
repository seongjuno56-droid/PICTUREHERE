/**
 * csv.js
 * =======
 * 매장 데이터(dict 배열) ↔ CSV 문자열/파일 변환 유틸.
 * fs 접근이 필요한 함수(write*)는 Node 전용이라 Next.js 서버 코드에서만 써야 한다
 * (브라우저/Edge 런타임에는 노출 금지).
 */

import { writeFileSync, readFileSync } from "node:fs";

const BOM = "﻿"; // 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM을 붙인다.

/** CSV 한 필드 값을 안전하게 escape 한다 (쉼표/줄바꿈/쌍따옴표 포함 시 쌍따옴표로 감싼다). */
export function escapeCsvField(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * dict 배열을 CSV 문자열로 변환한다.
 * API 응답 필드가 매장마다 조금씩 다를 수 있으므로(값이 없으면 키 자체가 빠지는 경우),
 * 전체 아이템을 훑어 등장한 모든 필드명을 모아 헤더로 사용한다.
 */
export function itemsToCsvString(items, { fieldnames } = {}) {
  if (!items.length) return "";

  let fields = fieldnames;
  if (!fields) {
    fields = [];
    const seen = new Set();
    for (const item of items) {
      for (const key of Object.keys(item)) {
        if (!seen.has(key)) {
          seen.add(key);
          fields.push(key);
        }
      }
    }
  }

  const lines = [fields.join(",")];
  for (const item of items) {
    lines.push(fields.map((key) => escapeCsvField(item[key])).join(","));
  }
  return lines.join("\n") + "\n";
}

/**
 * dict 배열을 CSV 파일로 저장한다. (비어 있으면 빈 파일만 생성)
 *
 * Windows에서는 백신/인덱싱/동기화 프로그램이 파일을 순간적으로 잠가
 * EBUSY/EPERM 오류가 나는 경우가 있어, 짧은 간격으로 몇 번 재시도한다.
 */
export function writeItemsCsv(items, filePath, opts) {
  const content = items.length ? BOM + itemsToCsvString(items, opts) : "";
  writeFileWithRetry(filePath, content);
}

function sleepSync(ms) {
  // Atomics.wait로 CPU를 점유하지 않는 동기 대기를 구현 (버스-웨이트 금지)
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function writeFileWithRetry(filePath, content, retriesLeft = 5) {
  try {
    writeFileSync(filePath, content, "utf8");
  } catch (err) {
    if (retriesLeft > 0 && (err.code === "EBUSY" || err.code === "EPERM")) {
      sleepSync(500);
      writeFileWithRetry(filePath, content, retriesLeft - 1);
      return;
    }
    throw err;
  }
}

/**
 * CSV 텍스트를 파싱해서 dict 배열로 되돌린다 (RFC4180 스타일: 쌍따옴표로 감싼 필드 안의
 * 쉼표/줄바꿈/이스케이프된 쌍따옴표("")를 올바르게 처리).
 * writeItemsCsv로 저장한 파일을 다시 읽어 재가공할 때 사용한다 (예: 외부 API를 다시
 * 호출하지 않고 저장된 all_stores.csv에서 파생 CSV를 재생성할 때).
 */
export function parseCsv(text) {
  const content = text.startsWith(BOM) ? text.slice(1) : text;
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];

    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\r") {
      // \r\n 줄바꿈의 \r은 무시 (다음 \n에서 처리)
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmptyRows = rows.filter((r) => !(r.length === 1 && r[0] === ""));
  if (nonEmptyRows.length === 0) return [];

  const [header, ...dataRows] = nonEmptyRows;
  return dataRows.map((cols) => {
    const obj = {};
    header.forEach((key, idx) => {
      obj[key] = cols[idx] ?? "";
    });
    return obj;
  });
}

/** CSV 파일을 읽어 dict 배열로 반환한다. */
export function readItemsCsv(filePath) {
  return parseCsv(readFileSync(filePath, "utf8"));
}
