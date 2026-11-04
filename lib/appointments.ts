import { SqliteError } from "better-sqlite3";
import { getDb } from "./db";
import { isIsoDate, isTime, localStamp, normalizePhone, validateName } from "./format";
import { getMedic } from "./medics";
import { notifyGroup } from "./notify";
import { APPOINTMENT_SELECT, mapAppointment, type AppointmentRow } from "./rows";
import { daySlots } from "./slots";
import type { Appointment } from "./types";

export type CreateAppointmentInput = {
  medicId: number;
  date: string;
  time: string;
  clientName: string;
  clientPhone: string;
  source?: "site" | "telegram";
  telegramUserId?: string | null;
};

function isUnique(error: unknown): boolean {
  return error instanceof SqliteError && error.code.startsWith("SQLITE_CONSTRAINT");
}

function getAppointment(id: number): Appointment | null {
  const row = getDb()
    .prepare(`${APPOINTMENT_SELECT} WHERE a.id = ?`)
    .get(id) as AppointmentRow | undefined;
  return row ? mapAppointment(row) : null;
}

export async function createAppointment(
  input: CreateAppointmentInput,
): Promise<{ ok: true; appointment: Appointment } | { ok: false; error: string; status: number }> {
  const medic = getMedic(input.medicId);
  if (!medic) return { ok: false, error: "Медик не найден", status: 404 };
  if (!isIsoDate(input.date)) return { ok: false, error: "Укажите день приёма", status: 400 };
  if (!isTime(input.time)) return { ok: false, error: "Укажите время приёма", status: 400 };
  const name = validateName(input.clientName);
  if (!name) return { ok: false, error: "Укажите имя и фамилию", status: 400 };
  const phone = normalizePhone(input.clientPhone);
  if (!phone) return { ok: false, error: "Телефон нужен в формате +998 и 9 цифр", status: 400 };
  const source = input.source ?? "site";
  if (source === "telegram" && !input.telegramUserId) {
    return { ok: false, error: "Не удалось определить Telegram", status: 400 };
  }

  const slots = daySlots(medic.id, input.date);
  const slot = slots.find((item) => item.time === input.time);
  if (!slot) return { ok: false, error: "Это время недоступно", status: 400 };
  if (slot.taken) return { ok: false, error: "Это время уже занято", status: 409 };

  try {
    const result = getDb()
      .prepare(
        `INSERT INTO appointments
          (medic_id, date, time, client_name, client_phone, source, telegram_user_id, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'booked', ?)`,
      )
      .run(
        medic.id,
        input.date,
        input.time,
        name,
        phone,
        source,
        source === "telegram" ? input.telegramUserId : null,
        localStamp(),
      );
    const appointment = getAppointment(Number(result.lastInsertRowid));
    if (!appointment) return { ok: false, error: "Не удалось сохранить заявку", status: 500 };
    await notifyGroup(appointment, "created");
    return { ok: true, appointment };
  } catch (error) {
    if (isUnique(error)) return { ok: false, error: "Это время уже занято", status: 409 };
    throw error;
  }
}

export async function cancelAppointment(
  id: number,
  telegramUserId: string,
): Promise<{ ok: true; appointment: Appointment } | { ok: false; error: string }> {
  const current = getAppointment(id);
  if (!current || current.status !== "booked" || current.telegramUserId !== telegramUserId) {
    return { ok: false, error: "Запись не найдена" };
  }
  getDb().prepare("UPDATE appointments SET status = 'cancelled' WHERE id = ?").run(id);
  const appointment = getAppointment(id);
  if (!appointment) return { ok: false, error: "Запись не найдена" };
  await notifyGroup(appointment, "cancelled");
  return { ok: true, appointment };
}

export function listForTelegram(telegramUserId: string): Appointment[] {
  const rows = getDb()
    .prepare(
      `${APPOINTMENT_SELECT}
       WHERE a.telegram_user_id = ? AND a.status = 'booked'
       ORDER BY a.date, a.time`,
    )
    .all(telegramUserId) as AppointmentRow[];
  return rows.map(mapAppointment);
}

export function appointmentsBetween(medicId: number | null, from: string, to: string): Appointment[] {
  const rows = getDb()
    .prepare(
      `${APPOINTMENT_SELECT}
       WHERE a.status = 'booked' AND a.date >= ? AND a.date <= ? AND (? IS NULL OR a.medic_id = ?)
       ORDER BY a.date, a.time, m.name`,
    )
    .all(from, to, medicId, medicId) as AppointmentRow[];
  return rows.map(mapAppointment);
}
