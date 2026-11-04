import { getDb } from "./db";
import { isTime, slotTimes, toMinutes } from "./format";
import { mapMedic, type MedicRow } from "./rows";
import type { Medic, MedicInput, ScheduleInterval } from "./types";

const SLOT_MINUTES = new Set([20, 30, 40, 60]);

export function listMedics(): Medic[] {
  const rows = getDb()
    .prepare("SELECT id, name, specialty, slot_minutes FROM medics WHERE active = 1 ORDER BY id")
    .all() as MedicRow[];
  return rows.map(mapMedic);
}

export function getMedic(id: number): Medic | null {
  const row = getDb()
    .prepare("SELECT id, name, specialty, slot_minutes FROM medics WHERE id = ? AND active = 1")
    .get(id) as MedicRow | undefined;
  return row ? mapMedic(row) : null;
}

export function parseMedicInput(body: unknown): { ok: true; value: MedicInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Пустая форма" };
  const source = body as Record<string, unknown>;
  const name = typeof source.name === "string" ? source.name.trim().replace(/\s+/g, " ") : "";
  const specialty = typeof source.specialty === "string" ? source.specialty.trim().replace(/\s+/g, " ") : "";
  const slotMinutes = Number(source.slotMinutes);
  if (name.length < 2 || name.length > 80) return { ok: false, error: "Укажите имя медика" };
  if (specialty.length < 2 || specialty.length > 80) return { ok: false, error: "Укажите специальность" };
  if (!SLOT_MINUTES.has(slotMinutes)) return { ok: false, error: "Длительность приёма: 20, 30, 40 или 60 минут" };
  if (!Array.isArray(source.schedule) || source.schedule.length === 0) {
    return { ok: false, error: "Отметьте хотя бы один рабочий день" };
  }

  const schedule: ScheduleInterval[] = [];
  const seen = new Set<number>();
  for (const item of source.schedule) {
    if (!item || typeof item !== "object") return { ok: false, error: "Проверьте график" };
    const row = item as Record<string, unknown>;
    const weekday = Number(row.weekday);
    const start = typeof row.start === "string" ? row.start.slice(0, 5) : "";
    const end = typeof row.end === "string" ? row.end.slice(0, 5) : "";
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      return { ok: false, error: "Проверьте дни недели" };
    }
    if (seen.has(weekday)) return { ok: false, error: "День недели указан дважды" };
    if (!isTime(start) || !isTime(end) || toMinutes(end) <= toMinutes(start)) {
      return { ok: false, error: "Конец дня должен быть позже начала" };
    }
    if (slotTimes(start, end, slotMinutes).length === 0) {
      return { ok: false, error: "В этот день не помещается ни один приём" };
    }
    seen.add(weekday);
    schedule.push({ weekday, start, end });
  }

  return { ok: true, value: { name, specialty, slotMinutes, schedule } };
}

function writeMedic(id: number, input: MedicInput) {
  const db = getDb();
  const save = db.transaction(() => {
    db.prepare("UPDATE medics SET name = ?, specialty = ?, slot_minutes = ? WHERE id = ?").run(
      input.name,
      input.specialty,
      input.slotMinutes,
      id,
    );
    db.prepare("DELETE FROM schedules WHERE medic_id = ?").run(id);
    const insert = db.prepare(
      "INSERT INTO schedules (medic_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?)",
    );
    for (const interval of input.schedule) {
      insert.run(id, interval.weekday, interval.start, interval.end);
    }
  });
  save();
}

export function createMedic(input: MedicInput): Medic {
  const db = getDb();
  const insert = db.transaction(() => {
    const result = db
      .prepare("INSERT INTO medics (name, specialty, slot_minutes, active) VALUES (?, ?, ?, 1)")
      .run(input.name, input.specialty, input.slotMinutes);
    const id = Number(result.lastInsertRowid);
    const add = db.prepare(
      "INSERT INTO schedules (medic_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?)",
    );
    for (const interval of input.schedule) {
      add.run(id, interval.weekday, interval.start, interval.end);
    }
    return id;
  });
  const medic = getMedic(insert());
  if (!medic) throw new Error("Медик не сохранился");
  return medic;
}

export function updateMedic(id: number, input: MedicInput): Medic | null {
  if (!getMedic(id)) return null;
  writeMedic(id, input);
  return getMedic(id);
}
