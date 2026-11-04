import Link from "next/link";
import { clinic } from "@/lib/clinic";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <p className="footer-brand">Верба</p>
          <p>Частная клиника в Казани. Запись на день, время и медика с сайта и из Telegram.</p>
        </div>
        <div>
          <h2>Разделы</h2>
          <Link href="/">Главная</Link>
          <Link href="/#medics">Медики</Link>
          <Link href="/book">Запись</Link>
          <Link href="/admin">Админка</Link>
        </div>
        <div>
          <h2>Как попасть</h2>
          <Link href="/book">Выбрать время</Link>
          <Link href="/#steps">Как записаться</Link>
          <a href={clinic.phoneHref}>{clinic.phone}</a>
        </div>
        <div>
          <h2>Контакты</h2>
          <p>
            {clinic.city}, {clinic.street}
          </p>
          <p>Пн–сб, по графику медика</p>
          <a href={clinic.phoneHref}>{clinic.phone}</a>
        </div>
      </div>
      <div className="shell footer-bar">
        <span>Клиника «Верба». Учебный макет, не медицинская организация.</span>
      </div>
    </footer>
  );
}
