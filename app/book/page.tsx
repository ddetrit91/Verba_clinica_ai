import { Suspense } from "react";
import { BookingDesk } from "@/components/BookingDesk";

export const dynamic = "force-dynamic";

export default function BookPage() {
  return (
    <main id="content">
      <section className="page-hero">
        <div className="shell">
          <p className="pill">Запись</p>
          <h1>День, время и медик</h1>
          <p>Сначала медик, затем день и время из его графика.</p>
        </div>
      </section>
      <div className="shell page-body">
        <Suspense fallback={<p className="note">Открываем запись</p>}>
          <BookingDesk />
        </Suspense>
      </div>
    </main>
  );
}
