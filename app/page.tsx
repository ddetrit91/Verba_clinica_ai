import Link from "next/link";
import { HeroParallax } from "@/components/HeroParallax";
import { Reveal } from "@/components/Reveal";
import { clinic } from "@/lib/clinic";
import { listMedics } from "@/lib/medics";
import { formatDay, formatSchedule, todayIso, weekdayOf } from "@/lib/format";

export const dynamic = "force-dynamic";

const STEPS = [
  { title: "Медик", text: "Выберите специалиста. Календарь сразу показывает только его дни." },
  { title: "День", text: "Рабочие дни открыты. Прошедшие и полностью занятые выбрать нельзя." },
  { title: "Время", text: "Слоты идут по графику медика. Занятое время пропадает сразу." },
  { title: "Заявка", text: "Имя и телефон. Та же запись доступна через Telegram." },
];

function medicsLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "медик";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "медика";
  return "медиков";
}

export default async function HomePage() {
  const medics = await listMedics();
  const today = todayIso();
  const weekday = weekdayOf(today);
  const onDuty = medics.flatMap((medic) => {
    const interval = medic.schedule.find((item) => item.weekday === weekday);
    return interval ? [{ ...medic, start: interval.start, end: interval.end }] : [];
  });
  const specialties = [...new Set(medics.map((medic) => medic.specialty))];
  const username = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "");

  return (
    <main id="content">
      <HeroParallax>
        <div className="shell hero-grid">
          <div className="hero-copy">
            <p className="pill">Клиника в {clinic.city}</p>
            <h1>Запись к медику в удобный день</h1>
            <p className="lede">
              Выберите день, время и медика. Заявка с сайта и из Telegram попадает в одно расписание клиники «Верба».
            </p>
            <div className="hero-actions">
              <Link className="btn" href="/book">
                Записаться
              </Link>
              <a className="btn-ghost" href="#medics">
                Смотреть медиков
              </a>
            </div>
            <dl className="stats">
              <div>
                <dt>Медиков</dt>
                <dd>{medics.length}</dd>
              </div>
              <div>
                <dt>Сегодня принимают</dt>
                <dd>{onDuty.length}</dd>
              </div>
              <div>
                <dt>Канала записи</dt>
                <dd>2</dd>
              </div>
            </dl>
          </div>
          <div className="hero-visual">
            <div className="visual-panel">
              <p>Сегодня, {formatDay(today)}</p>
              {onDuty.length === 0 ? <strong>Приёма нет</strong> : null}
              {onDuty.map((medic) => (
                <Link href={`/book?medic=${medic.id}`} key={medic.id}>
                  <strong>{medic.name}</strong>
                  <span>
                    {medic.specialty}, {medic.start}–{medic.end}
                  </span>
                </Link>
              ))}
            </div>
            <div className="float-card">
              <strong>
                {onDuty.length} {medicsLabel(onDuty.length)}
              </strong>
              <span>на сегодня</span>
            </div>
          </div>
        </div>
      </HeroParallax>

      <Reveal>
      <section className="section" id="about">
        <div className="shell about-grid">
          <div>
            <h2>Приём без звонка в регистратуру</h2>
            <p>
              «Верба» на {clinic.street}. Пациент сам выбирает медика, день и время. Администратор задаёт, в какие дни и часы каждый медик принимает.
            </p>
            <ul className="checks">
              <li>Запись с сайта и из Telegram в одну базу</li>
              <li>Прошедшее время и чужой выходной недоступны</li>
              <li>Занятый слот нельзя выбрать второй раз</li>
              <li>Нагрузка на семь дней видна в админке</li>
            </ul>
            <Link className="btn" href="/book">
              Выбрать время
            </Link>
          </div>
          <div className="about-aside">
            <p className="pill">Сегодня</p>
            {onDuty.length === 0 ? <p>Сегодня приёма нет.</p> : null}
            {onDuty.map((medic) => (
              <Link className="person" href={`/book?medic=${medic.id}`} key={medic.id}>
                <strong>{medic.name}</strong>
                <span>{medic.specialty}</span>
                <span>
                  {medic.start}–{medic.end}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      </Reveal>

      <Reveal>
      <section className="section" id="services">
        <div className="shell">
          <div className="section-head">
            <h2>К кому можно записаться</h2>
            <p>Карточка открывает календарь медика этого направления.</p>
          </div>
          <div className="card-grid">
            {specialties.map((specialty) => {
              const group = medics.filter((medic) => medic.specialty === specialty);
              const count = group.length;
              const href = group[0] ? `/book?medic=${group[0].id}` : "/book";
              return (
                <article className="info-card" key={specialty}>
                  <h3>{specialty}</h3>
                  <p>
                    {count} {medicsLabel(count)} в расписании.
                  </p>
                  <Link href={href}>Записаться</Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>
      </Reveal>

      <Reveal>
      <section className="section" id="medics">
        <div className="shell">
          <div className="section-head">
            <h2>Медики клиники</h2>
            <p>График задаёт администратор. Кнопка открывает календарь этого медика.</p>
          </div>
          <div className="card-grid">
            {medics.map((medic) => (
              <article className="info-card" key={medic.id}>
                <h3>{medic.name}</h3>
                <p>{medic.specialty}</p>
                <p className="muted">{formatSchedule(medic.schedule)}</p>
                <Link href={`/book?medic=${medic.id}`}>Выбрать время</Link>
              </article>
            ))}
          </div>
        </div>
      </section>
      </Reveal>

      <Reveal>
      <section className="section" id="steps">
        <div className="shell">
          <div className="section-head">
            <h2>Четыре шага до заявки</h2>
          </div>
          <ol className="steps">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <span>0{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      </Reveal>

      <Reveal>
      <section className="cta-band">
        <div className="shell cta-inner">
          <div>
            <h2>Готовы выбрать время?</h2>
            <p>
              {clinic.city}, {clinic.street}. Телефон {clinic.phone}.
              {username ? " Запись также открыта в Telegram." : ""}
            </p>
          </div>
          <div className="hero-actions">
            <Link className="btn" href="/book">
              Записаться
            </Link>
            {username ? (
              <a className="btn-ghost" href={`https://t.me/${username}`}>
                Открыть бота
              </a>
            ) : (
              <a className="btn-ghost" href={clinic.phoneHref}>
                Позвонить
              </a>
            )}
          </div>
        </div>
      </section>
      </Reveal>
    </main>
  );
}
