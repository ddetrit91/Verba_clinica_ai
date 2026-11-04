export function webhookSecret(): string {
  const raw = (process.env.TELEGRAM_WEBHOOK_SECRET || process.env.ADMIN_SECRET || "").trim();
  const cleaned = raw.replace(/[^A-Za-z0-9_-]/g, "");
  if (cleaned.length < 8) throw new Error("Нет секрета для webhook Telegram");
  return cleaned.slice(0, 256);
}

export function publicOrigin(): string {
  const raw = process.env.WEBAPP_URL?.trim() || "https://verba-clinica.vercel.app/tg";
  const url = new URL(raw);
  return url.origin;
}

export function webhookUrl(): string {
  return `${publicOrigin()}/api/telegram`;
}
