import type { Appointment } from "./types";
import { formatPhone, formatWhen } from "./format";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function clinicChatId(): string | null {
  const chatId = process.env.TELEGRAM_GROUP_CHAT_ID?.trim() ?? "";
  return chatId || null;
}

export async function notifyGroup(appointment: Appointment, kind: "created" | "cancelled"): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = clinicChatId();
  if (!token || !chatId) {
    console.warn("Дубль в группу пропущен: нет TELEGRAM_BOT_TOKEN или TELEGRAM_GROUP_CHAT_ID");
    return false;
  }
  const botId = token.split(":")[0];
  if (chatId === botId) {
    console.error("TELEGRAM_GROUP_CHAT_ID совпадает с id бота. Сообщение всё равно отправляется на это значение.");
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
      let description = "";
      try {
        description = String((JSON.parse(body) as { description?: string }).description ?? "");
      } catch {
        description = "";
      }
      console.error("Не удалось отправить дубль в чат TELEGRAM_GROUP_CHAT_ID", response.status, description);
      return false;
    }
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Не удалось отправить дубль в чат TELEGRAM_GROUP_CHAT_ID", message.replace(/bot\d+:[A-Za-z0-9_-]+/g, "bot[redacted]"));
    return false;
  }
}
