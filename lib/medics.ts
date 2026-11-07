import { all, one, tx } from "./db";
import { isTime, slotTimes, toMinutes } from "./format";
import { mapMedic, type MedicRow } from "./rows";
import { queryAll, queryOne, type Queryable } from "./sql";
import type { Medic, MedicInput, ScheduleInterval } from "./types";

const SLOT_MINUTES = new Set([20, 30, 40, 60]);

type ScheduleRow = ScheduleInterval & { medic_id: number };

async function schedulesByMedic(medicIds: number[]): Promise<Map<number, ScheduleInterval[]>> {
  const grouped = new Map<number, ScheduleInterval[]>();
  if (medicIds.length === 0) return grouped;
  const rows = await all<ScheduleRow>(
    `SELECT medic_id, weekday, start_time AS start, end_time AS end
     FROM schedules
     WHERE medic_id = ANY(?::int[])
     ORDER BY weekday`,
    [medicIds],
  );
  for (const row of rows) {
    const list = grouped.get(row.medic_id) ?? [];
    list.push({ weekday: row.weekday, start: row.start, end: row.end });
    grouped.set(row.medic_id, list);
  }
  return grouped;
}

export async function listMedics(): Promise<Medic[]> {
  const rows = await all<MedicRow>(
    "SELECT id, name, specialty, slot_minutes, photo FROM medics WHERE active = 1 ORDER BY id",
  );
  const schedules = await schedulesByMedic(rows.map((row) => row.id));
  return rows.map((row) => mapMedic(row, schedules.get(row.id) ?? []));
}

export async function getMedic(id: number): Promise<Medic | null> {
  const row = await one<MedicRow>(
    "SELECT id, name, specialty, slot_minutes, photo FROM medics WHERE id = ? AND active = 1",
    [id],
  );
  if (!row) return null;
  const schedules = await schedulesByMedic([id]);
  return mapMedic(row, schedules.get(id) ?? []);
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

async function writeSchedule(db: Queryable, id: number, input: MedicInput) {
  await db.query(toPgUpdateMedic(), [input.name, input.specialty, input.slotMinutes, id]);
  await queryAll(db, "DELETE FROM schedules WHERE medic_id = ?", [id]);
  for (const interval of input.schedule) {
    await queryAll(db, "INSERT INTO schedules (medic_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?)", [
      id,
      interval.weekday,
      interval.start,
      interval.end,
    ]);
  }
}

function toPgUpdateMedic(): string {
  return "UPDATE medics SET name = $1, specialty = $2, slot_minutes = $3 WHERE id = $4";
}

export async function createMedic(input: MedicInput): Promise<Medic> {
  const id = await tx(async (db) => {
    const row = await queryOne<{ id: number }>(
      db,
      "INSERT INTO medics (name, specialty, slot_minutes, active) VALUES (?, ?, ?, 1) RETURNING id",
      [input.name, input.specialty, input.slotMinutes],
    );
    if (!row) throw new Error("Медик не сохранился");
    for (const interval of input.schedule) {
      await queryAll(db, "INSERT INTO schedules (medic_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?)", [
        row.id,
        interval.weekday,
        interval.start,
        interval.end,
      ]);
    }
    return row.id;
  });
  const medic = await getMedic(id);
  if (!medic) throw new Error("Медик не сохранился");
  return medic;
}

export async function updateMedic(id: number, input: MedicInput): Promise<Medic | null> {
  if (!(await getMedic(id))) return null;
  await tx(async (db) => {
    await writeSchedule(db, id, input);
  });
  return getMedic(id);
}
