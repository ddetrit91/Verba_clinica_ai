import { Suspense } from "react";
import { TelegramBooking } from "@/components/TelegramBooking";

export const dynamic = "force-dynamic";

export default function TelegramPage() {
  return (
    <main id="content" className="tg-app">
      <section className="page-hero">
        <div className="shell">
          <p className="pill">Верба</p>
          <h1>Запись к медику</h1>
          <p>Выберите медика, день и время.</p>
        </div>
      </section>
      <div className="shell page-body">
        <Suspense fallback={<p className="note">Открываем календарь</p>}>
          <TelegramBooking />
        </Suspense>
      </div>
    </main>
  );
}
