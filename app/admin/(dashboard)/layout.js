import AdminNav from "../../../components/admin/AdminNav.js";

export const metadata = {
  title: "픽처히어 어드민",
};

export default function AdminLayout({ children }) {
  return (
    <div style={{ display: "flex" }}>
      <AdminNav />
      <main style={{ flex: 1, padding: "28px 32px", minWidth: 0 }}>{children}</main>
    </div>
  );
}
