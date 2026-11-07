"use client";

import { useEffect, useState } from "react";
import { WEEKDAY_ORDER, WEEKDAY_SHORT, formatDay, formatPhone, formatSchedule } from "@/lib/format";
import { MedicFace } from "@/components/MedicFace";
import type { Appointment, Medic, ScheduleInterval } from "@/lib/types";

type LoadMedic = Medic & {
  booked: number;
  total: number;
  occupancy: number;
  todayAppointments: Appointment[];
};

type Report = {
  today: string;
  medics: LoadMedic[];
  todayAppointments: Appointment[];
};

type DayDraft = { enabled: boolean; start: string; end: string };

const EMPTY_DAYS = (): DayDraft[] =>
  [0, 1, 2, 3, 4, 5, 6].map(() => ({ enabled: false, start: "09:00", end: "17:00" }));

function draftsFrom(schedule: ScheduleInterval[]): DayDraft[] {
  const drafts = EMPTY_DAYS();
  for (const interval of schedule) {
    drafts[interval.weekday] = { enabled: true, start: interval.start, end: interval.end };
  }
  return drafts;
}

export function AdminDesk() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [days, setDays] = useState<DayDraft[]>(EMPTY_DAYS);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [remindBusy, setRemindBusy] = useState<number | null>(null);
  const [remindNote, setRemindNote] = useState("");
  const [remindOk, setRemindOk] = useState(false);

  async function load() {
    const response = await fetch("/api/admin/stats");
    if (response.status === 401) {
      setAuthed(false);
      setReport(null);
      return;
    }
    const data = (await response.json()) as Report;
    setAuthed(true);
    setReport(data);
  }

  useEffect(() => {
    void load();
  }, []);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      setError("Неверный пароль");
      return;
    }
    setPassword("");
    await load();
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
    setReport(null);
  }

  function edit(medic: LoadMedic) {
    setEditingId(medic.id);
    setName(medic.name);
    setSpecialty(medic.specialty);
    setSlotMinutes(medic.slotMinutes);
    setDays(draftsFrom(medic.schedule));
    setError("");
  }

  function clearForm() {
    setEditingId(null);
    setName("");
    setSpecialty("");
    setSlotMinutes(30);
    setDays(EMPTY_DAYS());
    setError("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const schedule = days.flatMap((day, weekday) =>
      day.enabled ? [{ weekday, start: day.start, end: day.end }] : [],
    );
    const payload = { name, specialty, slotMinutes, schedule };
    const response = await fetch(editingId ? `/api/admin/doctors/${editingId}` : "/api/admin/doctors", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Не удалось сохранить медика");
      return;
    }
    clearForm();
    await load();
  }

  async function remind(id: number) {
    setRemindBusy(id);
    setRemindNote("");
    const response = await fetch(`/api/admin/appointments/${id}/remind`, { method: "POST" });
    const data = (await response.json()) as { error?: string };
    setRemindBusy(null);
    if (!response.ok) {
      setRemindOk(false);
      setRemindNote(data.error ?? "Не удалось отправить напоминание");
      return;
    }
    setRemindOk(true);
    setRemindNote("Напоминание отправлено в Telegram");
  }

  if (authed === null) return <p className="note">Открываем админку</p>;

  if (!authed) {
    return (
      <form className="login-form" onSubmit={login}>
        <h2 className="page-title">Вход</h2>
        <p className="page-lead">Здесь нагрузка медиков и их график.</p>
        <label>
          Пароль
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn" type="submit">
          Войти
        </button>
      </form>
    );
  }

  return (
    <div>
      <div className="month-bar">
        <h2 className="page-title">Нагрузка</h2>
        <button type="button" className="btn-ghost" onClick={logout}>
          Выйти
        </button>
      </div>
      <p className="page-lead">Семь дней, включая сегодня. Новая заявка с сайта или из бота сразу меняет занятость.</p>

      <section aria-labelledby="meters">
        <h2 id="meters">Медики за 7 дней</h2>
        {report?.medics.map((medic) => (
          <div className="load-row" key={medic.id}>
            <div className="load-top">
              <strong>
                {medic.name}, {medic.specialty}
              </strong>
              <span>
                {medic.booked} из {medic.total}
              </span>
            </div>
            <div
              className="meter"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, medic.occupancy)}
              aria-label={`${medic.name}: ${medic.booked} из ${medic.total}`}
            >
              <span style={{ width: `${Math.min(100, medic.occupancy)}%` }} />
            </div>
          </div>
        ))}
      </section>

      <section className="section" aria-labelledby="today-apps">
        <h2 id="today-apps">Заявки на сегодня, {report ? formatDay(report.today) : ""}</h2>
        {report && report.todayAppointments.length === 0 ? <p className="note">На сегодня заявок нет.</p> : null}
        {remindNote ? <p className={remindOk ? "note" : "error"}>{remindNote}</p> : null}
        {report?.todayAppointments.map((item) => (
          <div className="table-row" key={item.id}>
            <strong>{item.time}</strong>
            <span>{item.clientName}</span>
            <span>{formatPhone(item.clientPhone)}</span>
            <span>{item.medicName}</span>
            <span className="muted">{item.source === "site" ? "сайт" : "Telegram"}</span>
            {item.telegramUserId ? (
              <button
                type="button"
                className="btn-ghost"
                disabled={remindBusy === item.id}
                onClick={() => void remind(item.id)}
              >
                Напомнить
              </button>
            ) : (
              <span className="muted">нет Telegram</span>
            )}
          </div>
        ))}
      </section>

      <section className="section" aria-labelledby="medic-form">
        <h2 id="medic-form">{editingId ? "График медика" : "Новый медик"}</h2>
        <form className="form-grid" onSubmit={save}>
          <label>
            Имя
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            Специальность
            <input value={specialty} onChange={(event) => setSpecialty(event.target.value)} required />
          </label>
          <label>
            Длительность приёма, минут
            <select value={slotMinutes} onChange={(event) => setSlotMinutes(Number(event.target.value))}>
              {[20, 30, 40, 60].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes}
                </option>
              ))}
            </select>
          </label>
          <div className="schedule-grid">
            {WEEKDAY_ORDER.map((weekday) => {
              const day = days[weekday];
              return (
                <div className="schedule-line" key={weekday}>
                  <label>
                    <input
                      type="checkbox"
                      checked={day.enabled}
                      onChange={(event) =>
                        setDays((current) =>
                          current.map((item, index) =>
                            index === weekday ? { ...item, enabled: event.target.checked } : item,
                          ),
                        )
                      }
                    />
                    {WEEKDAY_SHORT[weekday]}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="09:00"
                    spellCheck={false}
                    aria-label={`Начало, ${WEEKDAY_SHORT[weekday]}`}
                    value={day.start}
                    disabled={!day.enabled}
                    onChange={(event) =>
                      setDays((current) =>
                        current.map((item, index) => (index === weekday ? { ...item, start: event.target.value } : item)),
                      )
                    }
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="17:00"
                    spellCheck={false}
                    aria-label={`Конец, ${WEEKDAY_SHORT[weekday]}`}
                    value={day.end}
                    disabled={!day.enabled}
                    onChange={(event) =>
                      setDays((current) =>
                        current.map((item, index) => (index === weekday ? { ...item, end: event.target.value } : item)),
                      )
                    }
                  />
                </div>
              );
            })}
          </div>
          {error ? <p className="error">{error}</p> : null}
          <div className="actions">
            <button className="btn" type="submit" disabled={pending}>
              {editingId ? "Сохранить график" : "Добавить медика"}
            </button>
            {editingId ? (
              <button className="btn-ghost" type="button" onClick={clearForm}>
                Отмена
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="section" aria-labelledby="roster">
        <h2 id="roster">Кто уже в расписании</h2>
        {report?.medics.map((medic) => (
          <div className="person" key={medic.id}>
            <MedicFace name={medic.name} photo={medic.photo} size="row" />
            <strong>{medic.name}</strong>
            <span>
              {medic.specialty}, {medic.slotMinutes} мин
            </span>
            <span className="actions">
              <span className="muted">{formatSchedule(medic.schedule)}</span>
              <button type="button" className="btn-ghost" onClick={() => edit(medic)}>
                Изменить
              </button>
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
