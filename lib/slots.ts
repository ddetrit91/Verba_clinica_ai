import { all } from "./db";
import {
  addDays,
  daysInMonth,
  isBookableInstant,
  isIsoDate,
  isoDate,
  slotTimes,
  todayIso,
  weekdayOf,
} from "./format";
import { getMedic } from "./medics";
import type { DayCell, Medic, Slot } from "./types";

function openTimes(medic: Medic, date: string, options?: { hidePast?: boolean }): string[] {
  if (!isIsoDate(date)) return [];
  const interval = medic.schedule.find((item) => item.weekday === weekdayOf(date));
  if (!interval) return [];
  const hidePast = options?.hidePast !== false;
  return slotTimes(interval.start, interval.end, medic.slotMinutes).filter(
    (time) => !hidePast || isBookableInstant(date, time),
  );
}

export function scheduleSlotCount(medic: Medic, date: string, options?: { hidePast?: boolean }): number {
  return openTimes(medic, date, options).length;
}

async function takenBetween(medicId: number, from: string, to: string): Promise<Map<string, Set<string>>> {
  const rows = await all<{ date: string; time: string }>(
    `SELECT date, time FROM appointments
     WHERE medic_id = ? AND date >= ? AND date <= ? AND status = 'booked'`,
    [medicId, from, to],
  );
  const taken = new Map<string, Set<string>>();
  for (const row of rows) {
    const times = taken.get(row.date) ?? new Set<string>();
    times.add(row.time);
    taken.set(row.date, times);
  }
  return taken;
}

export async function daySlots(medicId: number, date: string, options?: { hidePast?: boolean }): Promise<Slot[]> {
  const medic = await getMedic(medicId);
  if (!medic) return [];
  const times = openTimes(medic, date, options);
  if (times.length === 0) return [];
  const taken = (await takenBetween(medicId, date, date)).get(date) ?? new Set<string>();
  return times.map((time) => ({ time, taken: taken.has(time) }));
}

export async function monthAvailability(medicId: number, year: number, month: number): Promise<DayCell[]> {
  const today = todayIso();
  const medic = await getMedic(medicId);
  const from = isoDate(year, month, 1);
  const to = isoDate(year, month, daysInMonth(year, month));
  const taken = medic ? await takenBetween(medicId, from, to) : new Map<string, Set<string>>();
  const cells: DayCell[] = [];
  for (let day = 1; day <= daysInMonth(year, month); day += 1) {
    const date = isoDate(year, month, day);
    const past = date < today;
    const times = medic && !past ? openTimes(medic, date, { hidePast: true }) : [];
    const busy = taken.get(date) ?? new Set<string>();
    const working = medic?.schedule.some((item) => item.weekday === weekdayOf(date)) ?? false;
    cells.push({
      date,
      past,
      working,
      free: times.filter((time) => !busy.has(time)).length,
      total: times.length,
    });
  }
  return cells;
}

export async function upcomingOpenDays(medicId: number, limit = 10): Promise<{ date: string; free: number }[]> {
  const today = todayIso();
  const medic = await getMedic(medicId);
  if (!medic) return [];
  const from = today;
  const to = addDays(today, 20);
  const taken = await takenBetween(medicId, from, to);
  const days: { date: string; free: number }[] = [];
  for (let offset = 0; offset < 21 && days.length < limit; offset += 1) {
    const date = addDays(today, offset);
    const times = openTimes(medic, date);
    const busy = taken.get(date) ?? new Set<string>();
    const free = times.filter((time) => !busy.has(time)).length;
    if (free > 0) days.push({ date, free });
  }
  return days;
}
