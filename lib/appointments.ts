import { all, isUniqueViolation, one } from "./db";
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

async function getAppointment(id: number): Promise<Appointment | null> {
  const row = await one<AppointmentRow>(`${APPOINTMENT_SELECT} WHERE a.id = ?`, [id]);
  return row ? mapAppointment(row) : null;
}

export async function createAppointment(
  input: CreateAppointmentInput,
): Promise<{ ok: true; appointment: Appointment } | { ok: false; error: string; status: number }> {
  const medic = await getMedic(input.medicId);
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

  const slots = await daySlots(medic.id, input.date);
  const slot = slots.find((item) => item.time === input.time);
  if (!slot) return { ok: false, error: "Это время недоступно", status: 400 };
  if (slot.taken) return { ok: false, error: "Это время уже занято", status: 409 };

  try {
    const row = await one<{ id: number }>(
      `INSERT INTO appointments
        (medic_id, date, time, client_name, client_phone, source, telegram_user_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'booked', ?)
       RETURNING id`,
      [
        medic.id,
        input.date,
        input.time,
        name,
        phone,
        source,
        source === "telegram" ? input.telegramUserId : null,
        localStamp(),
      ],
    );
    if (!row) return { ok: false, error: "Не удалось сохранить заявку", status: 500 };
    const appointment = await getAppointment(row.id);
    if (!appointment) return { ok: false, error: "Не удалось сохранить заявку", status: 500 };
    await notifyGroup(appointment, "created");
    return { ok: true, appointment };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "Это время уже занято", status: 409 };
    throw error;
  }
}

export async function cancelAppointment(
  id: number,
  telegramUserId: string,
): Promise<{ ok: true; appointment: Appointment } | { ok: false; error: string }> {
  const current = await getAppointment(id);
  if (!current || current.status !== "booked" || current.telegramUserId !== telegramUserId) {
    return { ok: false, error: "Запись не найдена" };
  }
  await one("UPDATE appointments SET status = 'cancelled' WHERE id = ?", [id]);
  const appointment = await getAppointment(id);
  if (!appointment) return { ok: false, error: "Запись не найдена" };
  await notifyGroup(appointment, "cancelled");
  return { ok: true, appointment };
}

export async function listForTelegram(telegramUserId: string): Promise<Appointment[]> {
  const rows = await all<AppointmentRow>(
    `${APPOINTMENT_SELECT}
     WHERE a.telegram_user_id = ? AND a.status = 'booked'
     ORDER BY a.date, a.time`,
    [telegramUserId],
  );
  return rows.map(mapAppointment);
}

export async function appointmentsBetween(
  medicId: number | null,
  from: string,
  to: string,
): Promise<Appointment[]> {
  const rows = await all<AppointmentRow>(
    `${APPOINTMENT_SELECT}
     WHERE a.status = 'booked' AND a.date >= ? AND a.date <= ? AND (?::int IS NULL OR a.medic_id = ?)
     ORDER BY a.date, a.time, m.name`,
    [from, to, medicId, medicId],
  );
  return rows.map(mapAppointment);
}
