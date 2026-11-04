import { AdminDesk } from "@/components/AdminDesk";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <main id="content">
      <section className="page-hero">
        <div className="shell">
          <p className="pill">Админка</p>
          <h1>Нагрузка медиков</h1>
          <p>Семь дней вперёд, график и новые специалисты.</p>
        </div>
      </section>
      <div className="shell page-body">
        <AdminDesk />
      </div>
    </main>
  );
}
