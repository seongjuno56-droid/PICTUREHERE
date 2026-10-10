import { query } from "../../../lib/db.js";

export const dynamic = "force-dynamic";

function Card({ title, children }) {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--divider)",
        borderRadius: "var(--radius-lg)",
        padding: "18px 20px",
      }}
    >
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-secondary)", margin: "0 0 14px" }}>{title}</h2>
      {children}
    </div>
  );
}

function EmptyNote({ children }) {
  return <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>{children}</p>;
}

export default async function AdminDashboardPage() {
  const [storesCountRes, recentStoresRes, inquiriesCountRes, recentInquiriesRes, logsCountRes] = await Promise.all([
    query("select count(*)::int as count from stores"),
    query("select name, branch_name, type, road_address, created_at from stores order by created_at desc limit 5"),
    query("select count(*)::int as count from inquiries where status = 'new'"),
    query("select name, message, status, created_at from inquiries order by created_at desc limit 5"),
    query("select count(*)::int as count from access_logs where created_at > now() - interval '24 hours'"),
  ]);

  const totalStores = storesCountRes.rows[0].count;
  const recentStores = recentStoresRes.rows;
  const newInquiriesCount = inquiriesCountRes.rows[0].count;
  const recentInquiries = recentInquiriesRes.rows;
  const logsLast24h = logsCountRes.rows[0].count;

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 20px" }}>대시보드</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        <Card title={`최근 추가된 매장 (전체 ${totalStores}개)`}>
          {recentStores.length === 0 ? (
            <EmptyNote>아직 등록된 매장이 없어요.</EmptyNote>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {recentStores.map((s, i) => (
                <li key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
                  <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                    {s.name}
                    {s.branch_name ? ` ${s.branch_name}` : ""}
                    <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}> · {s.type === "booth" ? "포토부스" : "사진관"}</span>
                  </span>
                  <span style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>
                    {new Date(s.created_at).toLocaleDateString("ko-KR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`최근 들어온 문의 (신규 ${newInquiriesCount}건)`}>
          {recentInquiries.length === 0 ? (
            <EmptyNote>아직 들어온 문의가 없어요.</EmptyNote>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {recentInquiries.map((q, i) => (
                <li key={i} style={{ fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{q.name}</span>
                    <span style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>
                      {new Date(q.created_at).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                  <div style={{ color: "var(--text-secondary)", marginTop: 2 }}>{q.message}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="최근 접속 로그량 (24시간)">
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>{logsLast24h}</div>
          <EmptyNote>로그 적재는 다음 단계에서 붙일 예정이에요.</EmptyNote>
        </Card>

        <Card title="API 연동 현황">
          <EmptyNote>로그 적재가 연결되면 여기에 차트로 표시돼요.</EmptyNote>
        </Card>
      </div>
    </div>
  );
}
