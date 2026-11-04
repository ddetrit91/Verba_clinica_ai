"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  WEEKDAY_ORDER,
  WEEKDAY_SHORT,
  formatDay,
  formatMonthTitle,
  formatPhone,
  formatSchedule,
  mondayOffset,
  normalizePhone,
  todayIso,
  validateName,
} from "@/lib/format";
import type { Appointment, DayCell, Medic, Slot } from "@/lib/types";
import type { TelegramBookingLink } from "@/components/TelegramBooking";

type DayState = "free" | "full" | "off" | "past" | "closed" | "selected";

function dayState(cell: DayCell | undefined, selected: string, today: string): DayState {
  if (!cell) return "off";
  if (cell.date === selected) return "selected";
  if (cell.past) return "past";
  if (!cell.working) return "off";
  if (cell.total === 0) return cell.date === today ? "closed" : "off";
  if (cell.free === 0) return "full";
  return "free";
}

export function BookingDesk({ telegram = null }: { telegram?: TelegramBookingLink | null }) {
  const searchParams = useSearchParams();
  const requestedMedic = Number(searchParams.get("medic"));
  const now = new Date();
  const [medics, setMedics] = useState<Medic[]>([]);
  const [medicId, setMedicId] = useState<number | null>(null);
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [days, setDays] = useState<DayCell[]>([]);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsReady, setSlotsReady] = useState(false);
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<Appointment | null>(null);

  const today = todayIso();
  const medic = medics.find((item) => item.id === medicId) ?? null;
  const minCursor = { year: now.getFullYear(), month: now.getMonth() + 1 };
  const atMin = cursor.year === minCursor.year && cursor.month === minCursor.month;

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/doctors", { signal: controller.signal })
      .then((response) => response.json())
      .then((data: { medics: Medic[] }) => setMedics(data.medics))
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError("Не удалось загрузить медиков. Обновите страницу.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const appliedMedic = useRef<number | null>(null);

  useEffect(() => {
    const suggested = telegram?.suggestedName.trim() ?? "";
    if (!suggested) return;
    setName((current) => (current.trim() ? current : suggested));
  }, [telegram]);

  useEffect(() => {
    if (!medics.length || !Number.isInteger(requestedMedic) || requestedMedic <= 0) return;
    if (!medics.some((item) => item.id === requestedMedic)) return;
    if (appliedMedic.current === requestedMedic) return;
    appliedMedic.current = requestedMedic;
    setMedicId(requestedMedic);
    setDate("");
    setTime("");
    setSlots([]);
    setDays([]);
    setSlotsReady(false);
    setDone(null);
    setError("");
  }, [medics, requestedMedic]);

  useEffect(() => {
    if (!medicId) return;
    const controller = new AbortController();
    fetch(`/api/calendar?medicId=${medicId}&year=${cursor.year}&month=${cursor.month}`, {
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((data: { days?: DayCell[]; error?: string }) => {
        if (data.days) setDays(data.days);
        else setError(data.error ?? "Не удалось открыть календарь");
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError("Не удалось открыть календарь");
      });
    return () => controller.abort();
  }, [medicId, cursor.year, cursor.month]);

  useEffect(() => {
    if (!medicId || !date) {
      setSlotsReady(false);
      return;
    }
    const controller = new AbortController();
    setSlotsReady(false);
    fetch(`/api/slots?medicId=${medicId}&date=${date}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data: { slots?: Slot[]; error?: string }) => {
        if (data.slots) {
          setSlots(data.slots);
          setSlotsReady(true);
        } else setError(data.error ?? "Не удалось показать время");
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError("Не удалось показать время");
      });
    return () => controller.abort();
  }, [medicId, date]);

  const cells = useMemo(() => {
    const lead = mondayOffset(cursor.year, cursor.month);
    const byDate = new Map(days.map((day) => [day.date, day]));
    return { lead, byDate };
  }, [cursor.year, cursor.month, days]);

  function chooseMedic(id: number) {
    setMedicId(id);
    setDate("");
    setTime("");
    setSlots([]);
    setDays([]);
    setSlotsReady(false);
    setError("");
    setDone(null);
  }

  function shiftMonth(delta: number) {
    setCursor((current) => {
      const dateValue = new Date(current.year, current.month - 1 + delta, 1);
      return { year: dateValue.getFullYear(), month: dateValue.getMonth() + 1 };
    });
    setDate("");
    setTime("");
    setSlots([]);
    setDays([]);
    setSlotsReady(false);
  }

  function chooseDate(next: string) {
    setDate(next);
    setTime("");
    setError("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!medicId || !date || !time) return;
    setPending(true);
    setError("");
    const response = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        medicId,
        date,
        time,
        clientName: name,
        phoneReady: phone,
        clientPhone: phone,
        ...(telegram
          ? { source: "telegram", telegramUserId: telegram.userId, initData: telegram.initData }
          : { source: "site" }),
      }),
    });
    const data = (await response.json()) as { appointment?: Appointment; error?: string };
    setPending(false);
    if (!response.ok || !data.appointment) {
      setError(data.error ?? "Заявку не удалось сохранить");
      if (response.status === 409) {
        setTime("");
        const refreshed = await fetch(`/api/slots?medicId=${medicId}&date=${date}`);
        const slotsData = (await refreshed.json()) as { slots?: Slot[] };
        if (slotsData.slots) setSlots(slotsData.slots);
      }
      return;
    }
    setDone(data.appointment);
  }

  function reset() {
    setDone(null);
    setDate("");
    setTime("");
    setName(telegram?.suggestedName.trim() ?? "");
    setPhone("");
    setSlots([]);
    setError("");
  }

  const nameOk = Boolean(validateName(name));
  const phoneOk = Boolean(normalizePhone(phone));
  const freeSlots = slots.filter((slot) => !slot.taken);

  return (
    <div className="book-layout">
      <div className="medic-column">
        <div className="medic-list" role="group" aria-label="Медик">
          {loading ? <p className="note">Загружаем медиков</p> : null}
          {medics.map((item) => (
            <button
              key={item.id}
              type="button"
              className="medic-pick"
              aria-pressed={item.id === medicId}
              onClick={() => chooseMedic(item.id)}
            >
              <strong>{item.name}</strong>
              <span>{item.specialty}</span>
              <small>{formatSchedule(item.schedule)}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <ol className="progress">
          <li data-state={!medic ? "now" : "done"}>Медик</li>
          <li data-state={medic && !date ? "now" : date ? "done" : "wait"}>День</li>
          <li data-state={date && !time ? "now" : time ? "done" : "wait"}>Время</li>
          <li data-state={time && !done ? "now" : done ? "done" : "wait"}>Имя и телефон</li>
        </ol>
        {done && medic ? (
          <div className="summary">
            <h2>Заявка {done.id} принята</h2>
            <p>
              {medic.name}, {medic.specialty}
            </p>
            <p>
              {formatDay(done.date)} в {done.time}
            </p>
            <p>Телефон для связи: {formatPhone(done.clientPhone)}</p>
            <button type="button" className="btn" onClick={reset}>
              Новая заявка
            </button>
          </div>
        ) : (
          <>
            {medic ? (
            <div className="month-bar">
              <h2>{formatMonthTitle(cursor.year, cursor.month)}</h2>
              <div className="actions">
                <button type="button" className="btn-ghost" onClick={() => shiftMonth(-1)} disabled={atMin}>
                  Назад
                </button>
                <button type="button" className="btn-ghost" onClick={() => shiftMonth(1)}>
                  Дальше
                </button>
              </div>
            </div>
            ) : null}

            {!medic ? <p className="note">Сначала выберите медика. Календарь откроет только его дни.</p> : null}

            {medic ? (
            <>
            <div className="weekdays" aria-hidden="true">
              {WEEKDAY_ORDER.map((weekday) => (
                <span key={weekday}>{WEEKDAY_SHORT[weekday]}</span>
              ))}
            </div>
            <div className="calendar-grid" aria-label="Дни приёма">
              {Array.from({ length: cells.lead }, (_, index) => (
                <div className="day-pad" key={`pad-${index}`} />
              ))}
              {days.map((cell) => {
                const state = dayState(cell, date, today);
                const disabled = state === "off" || state === "past" || state === "full" || state === "closed";
                const label =
                  state === "free" || state === "selected"
                    ? `${formatDay(cell.date)}, свободно ${cell.free}`
                    : state === "full"
                      ? `${formatDay(cell.date)}, свободного времени нет`
                      : state === "closed"
                        ? `${formatDay(cell.date)}, приём закончился`
                        : formatDay(cell.date);
                return (
                  <button
                    key={cell.date}
                    type="button"
                    className="day"
                    data-state={state}
                    data-today={cell.date === today ? "true" : "false"}
                    disabled={!medic || disabled}
                    aria-pressed={state === "selected"}
                    aria-label={label}
                    onClick={() => chooseDate(cell.date)}
                  >
                    <strong>{Number(cell.date.slice(-2))}</strong>
                    {state === "full" ? <small>нет мест</small> : null}
                    {state === "free" || state === "selected" ? <small>{cell.free}</small> : null}
                  </button>
                );
              })}
            </div>
            </>
            ) : null}

            {date && !slotsReady ? <p className="note">Загружаем время</p> : null}
            {date && slotsReady ? (
              <section aria-label="Время">
                <h3>Время, {formatDay(date)}</h3>
                {freeSlots.length === 0 ? (
                  <p className="note">В этот день свободного времени нет.</p>
                ) : (
                  <div className="slots">
                    {freeSlots.map((slot) => (
                      <button
                        key={slot.time}
                        type="button"
                        className="slot"
                        aria-pressed={slot.time === time}
                        onClick={() => setTime(slot.time)}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            ) : null}

            {time && medic ? (
              <form className="form-grid" onSubmit={submit}>
                <p className="summary">
                  {medic.name}, {medic.specialty}, {formatDay(date)} в {time}
                </p>
                <label>
                  Имя и фамилия
                  <input
                    name="name"
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Телефон
                  <input
                    name="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="+998 90 000-00-00"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    required
                  />
                </label>
                {error ? <p className="error">{error}</p> : null}
                <button className="btn" type="submit" disabled={pending || !nameOk || !phoneOk}>
                  {pending ? "Записываем" : "Оставить заявку"}
                </button>
              </form>
            ) : error ? (
              <p className="error">{error}</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
