import type { Appointment } from "./types";
import { formatPhone, formatWhen } from "./format";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function notifyGroup(appointment: Appointment, kind: "created" | "cancelled"): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_GROUP_CHAT_ID?.trim();
  if (!token || !chatId) {
    console.warn("Дубль в группу пропущен: нет TELEGRAM_BOT_TOKEN или TELEGRAM_GROUP_CHAT_ID");
    return;
  }

  const title = kind === "created" ? `Новая заявка №${appointment.id}` : `Отмена заявки №${appointment.id}`;
  const source = appointment.source === "site" ? "сайт" : "Telegram";
  const text = [
    `<b>${escapeHtml(title)}</b>`,
    `Источник: ${source}`,
    `Медик: ${escapeHtml(appointment.medicName)}, ${escapeHtml(appointment.specialty)}`,
    `Когда: ${escapeHtml(formatWhen(appointment.date, appointment.time))}`,
    `Пациент: ${escapeHtml(appointment.clientName)}`,
    `Телефон: ${escapeHtml(formatPhone(appointment.clientPhone))}`,
  ].join("\n");

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      console.error("Не удалось отправить дубль в группу", response.status, body);
    }
  } catch (error) {
    console.error("Не удалось отправить дубль в группу", error);
  }
}
