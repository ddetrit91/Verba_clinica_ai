import type { ScheduleInterval } from "./types";

export const WEEKDAY_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
export const WEEKDAY_LONG = [
  "воскресенье",
  "понедельник",
  "вторник",
  "среда",
  "четверг",
  "пятница",
  "суббота",
];
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const MONTHS_NOM = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
];

const MONTHS_GEN = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

export function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function todayIso(now = new Date()): string {
  return isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseIso(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseIso(value);
  return isoDate(date.getFullYear(), date.getMonth() + 1, date.getDate()) === value;
}

export function addDays(value: string, days: number): string {
  const date = parseIso(value);
  date.setDate(date.getDate() + days);
  return isoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function weekdayOf(value: string): number {
  return parseIso(value).getDay();
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function mondayOffset(year: number, month: number): number {
  return (new Date(year, month - 1, 1).getDay() + 6) % 7;
}

export function nowMinutes(now = new Date()): number {
  return now.getHours() * 60 + now.getMinutes();
}

export function toMinutes(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return Number.NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return Number.NaN;
  return hours * 60 + minutes;
}

export function fromMinutes(value: number): string {
  return `${pad(Math.floor(value / 60))}:${pad(value % 60)}`;
}

export function isTime(value: string): boolean {
  return Number.isInteger(toMinutes(value));
}

export function slotTimes(start: string, end: string, step: number): string[] {
  const from = toMinutes(start);
  const to = toMinutes(end);
  if (!Number.isInteger(from) || !Number.isInteger(to) || step <= 0 || to <= from) return [];
  const slots: string[] = [];
  for (let cursor = from; cursor + step <= to; cursor += step) {
    slots.push(fromMinutes(cursor));
  }
  return slots;
}

export function isBookableInstant(date: string, time: string, now = new Date()): boolean {
  const today = todayIso(now);
  if (date < today) return false;
  if (date > today) return true;
  return toMinutes(time) > nowMinutes(now);
}

export function formatMonthTitle(year: number, month: number): string {
  return `${MONTHS_NOM[month - 1]} ${year}`;
}

export function formatDay(value: string, now = new Date()): string {
  const date = parseIso(value);
  const text = `${date.getDate()} ${MONTHS_GEN[date.getMonth()]}`;
  if (date.getFullYear() !== now.getFullYear()) return `${text} ${date.getFullYear()}`;
  return text;
}

export function formatWhen(date: string, time: string): string {
  return `${WEEKDAY_LONG[weekdayOf(date)]}, ${formatDay(date)} в ${time}`;
}

export function formatSchedule(schedule: ScheduleInterval[]): string {
  if (schedule.length === 0) return "График не задан";
  const byDay = new Map(schedule.map((item) => [item.weekday, item]));
  const items = WEEKDAY_ORDER.map((weekday) => byDay.get(weekday)).filter(
    (item): item is ScheduleInterval => Boolean(item),
  );
  const parts: string[] = [];
  let index = 0;
  while (index < items.length) {
    let end = index;
    const key = `${items[index].start}|${items[index].end}`;
    while (end + 1 < items.length) {
      const next = items[end + 1];
      const adjacent = WEEKDAY_ORDER.indexOf(next.weekday) === WEEKDAY_ORDER.indexOf(items[end].weekday) + 1;
      if (!adjacent || `${next.start}|${next.end}` !== key) break;
      end += 1;
    }
    const from = items[index];
    const to = items[end];
    const days =
      from.weekday === to.weekday
        ? WEEKDAY_SHORT[from.weekday]
        : `${WEEKDAY_SHORT[from.weekday]}–${WEEKDAY_SHORT[to.weekday]}`;
    parts.push(`${days} ${from.start}–${from.end}`);
    index = end + 1;
  }
  return parts.join(", ");
}

export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("998") && digits.length === 12) digits = digits.slice(3);
  if (digits.length !== 9) return null;
  return `+998${digits}`;
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("998") ? digits.slice(3) : digits;
  if (local.length !== 9) return value;
  return `+998 ${local.slice(0, 2)} ${local.slice(2, 5)}-${local.slice(5, 7)}-${local.slice(7)}`;
}

export function validateName(input: string): string | null {
  const name = input.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) return null;
  if (!/[A-Za-zА-Яа-яЁё]/.test(name)) return null;
  return name;
}

export function localStamp(now = new Date()): string {
  return `${todayIso(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
