import { clinic } from "./clinic";
import { all, one } from "./db";
import { addDays, formatWhen, todayIso } from "./format";
import { APPOINTMENT_SELECT, mapAppointment, type AppointmentRow } from "./rows";
import type { Appointment } from "./types";

/** Учебные заявки сида пишут telegram id как 5000 + номер человека. Настоящие id Telegram гораздо больше. */
export const MIN_REAL_TELEGRAM_ID = 100_000;
const MAX_TRIES = 3;

type ReminderKind = "hour" | "soon";

type DueRow = AppointmentRow & {
  reminder_hour_sent: number;
  reminder_soon_sent: number;
  reminder_hour_tries: number;
  reminder_soon_tries: number;
};

const DUE_SELECT = `SELECT a.id, a.medic_id, m.name AS medic_name, m.specialty, a.date, a.time,
        a.client_name, a.client_phone, a.source, a.telegram_user_id, a.status, a.created_at,
        a.reminder_hour_sent, a.reminder_soon_sent, a.reminder_hour_tries, a.reminder_soon_tries
 FROM appointments a
 JOIN medics m ON m.id = a.medic_id`;

let ticking = false;

export function isRealTelegramUserId(value: string | null | undefined): boolean {
  if (!value || !/^\d+$/.test(value)) return false;
  try {
    return BigInt(value) >= BigInt(MIN_REAL_TELEGRAM_ID);
  } catch {
    return false;
  }
}

export function minutesUntilStart(date: string, time: string, now = new Date()): number {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const start = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return (start.getTime() - now.getTime()) / 60_000;
}

export function reminderText(appointment: Appointment, kind: ReminderKind | "manual", now = new Date()): string {
  const left = minutesUntilStart(appointment.date, appointment.time, now);
  let lead = "Напоминание о записи.";
  if (kind === "soon") lead = "До приёма около 5 минут.";
  if (kind === "hour") lead = left >= 50 ? "До приёма около часа." : `До приёма около ${Math.max(1, Math.round(left))} мин.`;
  return [
    clinic.fullName,
    lead,
    `Медик: ${appointment.medicName}, ${appointment.specialty}`,
    `Когда: ${formatWhen(appointment.date, appointment.time)}`,
  ].join("\n");
}

type SendResult = { ok: true } | { ok: false; error: string; retry: boolean };

export async function deliverReminder(
  appointment: Appointment,
  kind: ReminderKind | "manual",
  now = new Date(),
): Promise<SendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return { ok: false, error: "Не задан TELEGRAM_BOT_TOKEN, напоминание не отправлено.", retry: true };
  }
  if (!appointment.telegramUserId) {
    return { ok: false, error: "У клиента нет Telegram, напомнить нельзя.", retry: false };
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: appointment.telegramUserId,
        text: reminderText(appointment, kind, now),
      }),
    });
    if (response.ok) return { ok: true };
    const body = await response.text();
    console.error("Напоминание не ушло", appointment.id, response.status, body);
    const retry = response.status === 429 || response.status >= 500;
    return {
      ok: false,
      error: "Telegram не принял сообщение. Клиент мог заблокировать бота.",
      retry,
    };
  } catch (error) {
    console.error("Напоминание не ушло", appointment.id, error);
    return { ok: false, error: "Telegram не принял сообщение. Клиент мог заблокировать бота.", retry: true };
  }
}

async function markReminder(id: number, kind: ReminderKind, state: number) {
  const column = kind === "hour" ? "reminder_hour_sent" : "reminder_soon_sent";
  await one(`UPDATE appointments SET ${column} = ? WHERE id = ?`, [state, id]);
}

async function noteFailure(id: number, kind: ReminderKind, retry: boolean) {
  const sentColumn = kind === "hour" ? "reminder_hour_sent" : "reminder_soon_sent";
  const triesColumn = kind === "hour" ? "reminder_hour_tries" : "reminder_soon_tries";
  const row = await one<{ tries: number }>(`SELECT ${triesColumn} AS tries FROM appointments WHERE id = ?`, [id]);
  const tries = (row?.tries ?? 0) + 1;
  if (!retry || tries >= MAX_TRIES) {
    await one(`UPDATE appointments SET ${sentColumn} = 2, ${triesColumn} = ? WHERE id = ?`, [tries, id]);
    console.error(`Напоминание ${kind} для заявки ${id} больше не повторяем (попыток: ${tries}).`);
    return;
  }
  await one(`UPDATE appointments SET ${triesColumn} = ? WHERE id = ?`, [tries, id]);
}

async function skipUnreal(row: DueRow) {
  await one(
    `UPDATE appointments
     SET reminder_hour_sent = CASE WHEN reminder_hour_sent = 0 THEN 2 ELSE reminder_hour_sent END,
         reminder_soon_sent = CASE WHEN reminder_soon_sent = 0 THEN 2 ELSE reminder_soon_sent END
     WHERE id = ?`,
    [row.id],
  );
}

async function dueAppointments(now: Date): Promise<DueRow[]> {
  const today = todayIso(now);
  const tomorrow = addDays(today, 1);
  return all<DueRow>(
    `${DUE_SELECT}
     WHERE a.status = 'booked'
       AND a.telegram_user_id IS NOT NULL
       AND a.date >= ? AND a.date <= ?
       AND (a.reminder_hour_sent = 0 OR a.reminder_soon_sent = 0)
     ORDER BY a.date, a.time`,
    [today, tomorrow],
  );
}

async function sendKind(row: DueRow, kind: ReminderKind, now: Date) {
  const appointment = mapAppointment(row);
  const result = await deliverReminder(appointment, kind, now);
  if (result.ok) {
    await markReminder(row.id, kind, 1);
    console.info(`Напоминание ${kind} отправлено, заявка ${row.id}`);
    return;
  }
  await noteFailure(row.id, kind, result.retry);
}

export async function runDueReminders(now = new Date()): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    for (const row of await dueAppointments(now)) {
      if (!isRealTelegramUserId(row.telegram_user_id)) {
        await skipUnreal(row);
        continue;
      }
      const left = minutesUntilStart(row.date, row.time, now);
      if (left <= 0) {
        if (row.reminder_hour_sent === 0) await markReminder(row.id, "hour", 2);
        if (row.reminder_soon_sent === 0) await markReminder(row.id, "soon", 2);
        continue;
      }
      if (left <= 5) {
        if (row.reminder_hour_sent === 0) await markReminder(row.id, "hour", 2);
        if (row.reminder_soon_sent === 0) await sendKind(row, "soon", now);
        continue;
      }
      if (row.reminder_hour_sent === 0 && left <= 60) {
        await sendKind(row, "hour", now);
      }
    }
  } catch (error) {
    console.error("Планировщик напоминаний остановился на этом проходе", error);
  } finally {
    ticking = false;
  }
}

export async function sendManualReminder(
  id: number,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const row = await one<AppointmentRow>(`${APPOINTMENT_SELECT} WHERE a.id = ?`, [id]);
  if (!row) return { ok: false, error: "Заявка не найдена", status: 404 };
  const appointment = mapAppointment(row);
  if (appointment.status !== "booked") {
    return { ok: false, error: "Заявка отменена, напоминание не отправляем.", status: 400 };
  }
  if (!appointment.telegramUserId || !isRealTelegramUserId(appointment.telegramUserId)) {
    return { ok: false, error: "У клиента нет Telegram, напомнить нельзя.", status: 400 };
  }
  const result = await deliverReminder(appointment, "manual");
  if (!result.ok) return { ok: false, error: result.error, status: 502 };
  return { ok: true };
}
