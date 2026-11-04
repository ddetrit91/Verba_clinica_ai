import { getDb } from "./db";
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
import type { DayCell, Slot } from "./types";

function takenTimes(medicId: number, date: string): Set<string> {
  const rows = getDb()
    .prepare("SELECT time FROM appointments WHERE medic_id = ? AND date = ? AND status = 'booked'")
    .all(medicId, date) as { time: string }[];
  return new Set(rows.map((row) => row.time));
}

export function daySlots(medicId: number, date: string, options?: { hidePast?: boolean }): Slot[] {
  const medic = getMedic(medicId);
  if (!medic || !isIsoDate(date)) return [];
  const interval = medic.schedule.find((item) => item.weekday === weekdayOf(date));
  if (!interval) return [];
  const taken = takenTimes(medicId, date);
  const hidePast = options?.hidePast !== false;
  return slotTimes(interval.start, interval.end, medic.slotMinutes)
    .filter((time) => !hidePast || isBookableInstant(date, time))
    .map((time) => ({ time, taken: taken.has(time) }));
}

export function monthAvailability(medicId: number, year: number, month: number): DayCell[] {
  const today = todayIso();
  const cells: DayCell[] = [];
  for (let day = 1; day <= daysInMonth(year, month); day += 1) {
    const date = isoDate(year, month, day);
    const past = date < today;
    const slots = past ? [] : daySlots(medicId, date, { hidePast: true });
    const interval = getMedic(medicId)?.schedule.some((item) => item.weekday === weekdayOf(date)) ?? false;
    cells.push({
      date,
      past,
      working: interval,
      free: slots.filter((slot) => !slot.taken).length,
      total: slots.length,
    });
  }
  return cells;
}

export function upcomingOpenDays(medicId: number, limit = 10): { date: string; free: number }[] {
  const today = todayIso();
  const days: { date: string; free: number }[] = [];
  for (let offset = 0; offset < 21 && days.length < limit; offset += 1) {
    const date = addDays(today, offset);
    const slots = daySlots(medicId, date);
    const free = slots.filter((slot) => !slot.taken).length;
    if (free > 0) days.push({ date, free });
  }
  return days;
}
