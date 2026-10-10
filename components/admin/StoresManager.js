"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { PHOTO_BOOTH_BRANDS } from "../../lib/photoBoothBrands.js";
import { brandColor } from "../../lib/brandColors.js";

const BRAND_OPTIONS = [...PHOTO_BOOTH_BRANDS.map((b) => b.name), "기타"];

function BrandBadge({ brand }) {
  if (!brand) return <span style={{ color: "var(--text-tertiary)" }}>-</span>;
  const color = brandColor(brand);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: "var(--radius-pill)",
        border: `1px solid ${color}55`,
        background: `${color}1f`,
        color,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {brand}
    </span>
  );
}

const EMPTY_FORM = {
  name: "",
  branchName: "",
  categoryName: "",
  type: "booth",
  brand: "",
  ctprvnName: "",
  signguName: "",
  roadAddress: "",
  lotAddress: "",
  lat: "",
  lon: "",
  phone: "",
};

function inputStyle(extra) {
  return {
    width: "100%",
    padding: "9px 10px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--input-border)",
    background: "var(--surface-2)",
    color: "var(--text-primary)",
    fontSize: 13,
    outline: "none",
    ...extra,
  };
}

// 기본 브라우저 select(네모난 회색 화살표)는 다크 톤이랑 안 어울려서, 공개 지도 쪽
// select(variant="select")랑 같은 방식 — appearance:none + 커스텀 쉐브론 아이콘 — 으로
// 어드민 select도 통일했다.
function StyledSelect({ style = {}, ...props }) {
  return (
    <div style={{ position: "relative", display: "inline-block", width: style.width || "auto" }}>
      <select
        {...props}
        style={{
          ...style,
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          paddingRight: 30,
          cursor: props.disabled ? "not-allowed" : "pointer",
        }}
      />
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
      >
        <path d="M6 9l6 6 6-6" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function StoreFormModal({ initial, onClose, onSaved }) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState(() =>
    initial
      ? {
          name: initial.name || "",
          branchName: initial.branch_name || "",
          categoryName: initial.category_name || "",
          type: initial.type || "booth",
          brand: initial.brand || "",
          ctprvnName: initial.ctprvn_name || "",
          signguName: initial.signgu_name || "",
          roadAddress: initial.road_address || "",
          lotAddress: initial.lot_address || "",
          lat: String(initial.lat ?? ""),
          lon: String(initial.lon ?? ""),
          phone: initial.phone || "",
        }
      : EMPTY_FORM
  );
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const url = isEdit ? `/api/admin/stores/${initial.id}` : "/api/admin/stores";
      const method = isEdit ? "PATCH" : "POST";
      const payload = { ...form, brand: form.type === "booth" ? form.brand || undefined : null };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "저장에 실패했습니다.");
        return;
      }
      onSaved();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 420,
          maxHeight: "85vh",
          overflowY: "auto",
          background: "var(--surface-1)",
          border: "1px solid var(--divider)",
          borderRadius: "var(--radius-lg)",
          padding: "22px 24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, margin: "0 0 18px" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
            {isEdit ? "매장 수정" : "매장 추가"}
          </h2>
          {isEdit && (
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)" }}>
              조회수 {(initial.view_count ?? 0).toLocaleString("ko-KR")}회
            </span>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="매장명 *">
            <input value={form.name} onChange={(e) => set("name", e.target.value)} style={inputStyle()} required />
          </Field>
          <Field label="지점명">
            <input value={form.branchName} onChange={(e) => set("branchName", e.target.value)} style={inputStyle()} />
          </Field>
          <Field label="유형 *">
            <StyledSelect value={form.type} onChange={(e) => set("type", e.target.value)} style={inputStyle()}>
              <option value="booth">포토부스</option>
              <option value="studio">사진관</option>
            </StyledSelect>
          </Field>
          <Field label="브랜드 (포토부스만)">
            {form.type === "booth" ? (
              <StyledSelect value={form.brand} onChange={(e) => set("brand", e.target.value)} style={inputStyle()}>
                <option value="">자동 분류(이름 기준)</option>
                {BRAND_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </StyledSelect>
            ) : (
              <input value="-" disabled style={inputStyle({ color: "var(--text-tertiary)" })} />
            )}
          </Field>
          <Field label="업종명">
            <input value={form.categoryName} onChange={(e) => set("categoryName", e.target.value)} style={inputStyle()} />
          </Field>
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="시/도">
              <input value={form.ctprvnName} onChange={(e) => set("ctprvnName", e.target.value)} style={inputStyle()} />
            </Field>
            <Field label="시/군/구">
              <input value={form.signguName} onChange={(e) => set("signguName", e.target.value)} style={inputStyle()} />
            </Field>
          </div>
          <Field label="도로명 주소">
            <input value={form.roadAddress} onChange={(e) => set("roadAddress", e.target.value)} style={inputStyle()} />
          </Field>
          <Field label="지번 주소">
            <input value={form.lotAddress} onChange={(e) => set("lotAddress", e.target.value)} style={inputStyle()} />
          </Field>
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="위도(lat) *">
              <input value={form.lat} onChange={(e) => set("lat", e.target.value)} style={inputStyle()} required />
            </Field>
            <Field label="경도(lon) *">
              <input value={form.lon} onChange={(e) => set("lon", e.target.value)} style={inputStyle()} required />
            </Field>
          </div>
          <Field label="전화번호">
            <input value={form.phone} onChange={(e) => set("phone", e.target.value)} style={inputStyle()} />
          </Field>
        </div>

        {error && <p style={{ color: "var(--live)", fontSize: 13, marginTop: 14 }}>{error}</p>}

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ flex: 1, padding: "10px 0", borderRadius: "var(--radius-sm)", border: "1px solid var(--divider)", background: "transparent", color: "var(--text-secondary)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            취소
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{ flex: 1, padding: "10px 0", borderRadius: "var(--radius-sm)", border: "none", background: "var(--brand)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  );
}

export default function StoresManager() {
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [type, setType] = useState("");
  const [ctprvn, setCtprvn] = useState("");
  const [signgu, setSigngu] = useState("");
  const [brand, setBrand] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ total: 0, pageSize: 20, stores: [] });
  const [loading, setLoading] = useState(true);
  const [regions, setRegions] = useState([]); // [{ ctprvn, signgus: [...] }]
  const [modalInitial, setModalInitial] = useState(undefined); // undefined=closed, null=create, object=edit

  useEffect(() => {
    fetch("/api/admin/regions")
      .then((r) => r.json())
      .then((json) => setRegions(json.regions || []));
  }, []);

  const signguOptions = useMemo(() => {
    const found = regions.find((r) => r.ctprvn === ctprvn);
    return found ? [...found.signgus].sort() : [];
  }, [regions, ctprvn]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (type) params.set("type", type);
    if (ctprvn) params.set("ctprvn", ctprvn);
    if (signgu) params.set("signgu", signgu);
    if (brand) params.set("brand", brand);
    params.set("page", String(page));
    const res = await fetch(`/api/admin/stores?${params}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [q, type, ctprvn, signgu, brand, page]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    setPage(1);
    setQ(qInput);
  }

  function handleCtprvnChange(value) {
    setPage(1);
    setCtprvn(value);
    setSigngu(""); // 시/도 바뀌면 시/군/구 선택 초기화
  }

  async function handleDelete(store) {
    if (!confirm(`"${store.name}"${store.branch_name ? " " + store.branch_name : ""} 매장을 삭제할까요?`)) return;
    await fetch(`/api/admin/stores/${store.id}`, { method: "DELETE" });
    load();
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>매장 관리 ({data.total}개)</h1>
        <button
          onClick={() => setModalInitial(null)}
          style={{ padding: "9px 16px", borderRadius: "var(--radius-sm)", border: "none", background: "var(--brand)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          + 매장 추가
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 8 }}>
          <input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="매장명/지점명/주소 검색"
            style={inputStyle({ width: 220 })}
          />
          <button type="submit" style={{ padding: "0 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--divider)", background: "var(--surface-1)", color: "var(--text-primary)", fontSize: 13, cursor: "pointer" }}>
            검색
          </button>
        </form>
        <StyledSelect
          value={type}
          onChange={(e) => {
            setPage(1);
            setType(e.target.value);
          }}
          style={inputStyle({ width: 120 })}
        >
          <option value="">전체 유형</option>
          <option value="booth">포토부스</option>
          <option value="studio">사진관</option>
        </StyledSelect>
        <StyledSelect value={ctprvn} onChange={(e) => handleCtprvnChange(e.target.value)} style={inputStyle({ width: 140 })}>
          <option value="">전체 시/도</option>
          {regions.map((r) => (
            <option key={r.ctprvn} value={r.ctprvn}>
              {r.ctprvn}
            </option>
          ))}
        </StyledSelect>
        <StyledSelect
          value={signgu}
          onChange={(e) => {
            setPage(1);
            setSigngu(e.target.value);
          }}
          disabled={!ctprvn}
          style={inputStyle({ width: 140, opacity: ctprvn ? 1 : 0.5 })}
        >
          <option value="">전체 시/군/구</option>
          {signguOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </StyledSelect>
        <StyledSelect
          value={brand}
          onChange={(e) => {
            setPage(1);
            setBrand(e.target.value);
          }}
          style={inputStyle({ width: 150 })}
        >
          <option value="">전체 브랜드</option>
          {BRAND_OPTIONS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </StyledSelect>
      </div>

      <div style={{ background: "var(--surface-1)", border: "1px solid var(--divider)", borderRadius: "var(--radius-lg)", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--divider)" }}>
              {["매장명", "유형", "브랜드", "지역", "주소", "조회수", "활성", "등록일", ""].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 14px", color: "var(--text-tertiary)", fontWeight: 600, whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ padding: 20, color: "var(--text-tertiary)" }}>
                  불러오는 중...
                </td>
              </tr>
            ) : data.stores.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 20, color: "var(--text-tertiary)" }}>
                  조건에 맞는 매장이 없어요.
                </td>
              </tr>
            ) : (
              data.stores.map((s) => (
                <tr
                  key={s.id}
                  className="store-row"
                  onClick={() => setModalInitial(s)}
                  style={{ borderBottom: "1px solid var(--divider)", cursor: "pointer" }}
                >
                  <td style={{ padding: "10px 14px", color: "var(--text-primary)", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {s.name}
                    {s.branch_name ? ` ${s.branch_name}` : ""}
                  </td>
                  <td style={{ padding: "10px 14px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{s.type === "booth" ? "포토부스" : "사진관"}</td>
                  <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                    {s.type === "booth" ? <BrandBadge brand={s.brand || "기타"} /> : <span style={{ color: "var(--text-tertiary)" }}>-</span>}
                  </td>
                  <td style={{ padding: "10px 14px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    {[s.ctprvn_name, s.signgu_name].filter(Boolean).join(" ") || "-"}
                  </td>
                  <td style={{ padding: "10px 14px", color: "var(--text-secondary)" }}>{s.road_address || s.lot_address || "-"}</td>
                  <td className="font-mono" style={{ padding: "10px 14px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    {(s.view_count ?? 0).toLocaleString("ko-KR")}
                  </td>
                  <td style={{ padding: "10px 14px", color: s.is_active ? "var(--text-secondary)" : "var(--live)" }}>
                    {s.is_active ? "표시" : "숨김"}
                  </td>
                  <td style={{ padding: "10px 14px", color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
                    {new Date(s.created_at).toLocaleDateString("ko-KR")}
                  </td>
                  <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setModalInitial(s);
                      }}
                      style={{ border: "none", background: "transparent", color: "var(--brand)", fontSize: 12, fontWeight: 600, cursor: "pointer", marginRight: 10 }}
                    >
                      수정
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(s);
                      }}
                      style={{ border: "none", background: "transparent", color: "var(--live)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 16 }}>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          style={{ border: "1px solid var(--divider)", background: "transparent", color: "var(--text-secondary)", borderRadius: "var(--radius-sm)", padding: "6px 12px", cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.4 : 1 }}
        >
          이전
        </button>
        <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
          {page} / {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          style={{ border: "1px solid var(--divider)", background: "transparent", color: "var(--text-secondary)", borderRadius: "var(--radius-sm)", padding: "6px 12px", cursor: page >= totalPages ? "default" : "pointer", opacity: page >= totalPages ? 0.4 : 1 }}
        >
          다음
        </button>
      </div>

      {modalInitial !== undefined && (
        <StoreFormModal
          initial={modalInitial}
          onClose={() => setModalInitial(undefined)}
          onSaved={() => {
            setModalInitial(undefined);
            load();
          }}
        />
      )}
    </div>
  );
}
