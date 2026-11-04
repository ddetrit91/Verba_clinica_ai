import { createAppointment } from "@/lib/appointments";
import { readJson } from "@/lib/http";
import { isTelegramUserId, telegramUserIdFromInitData } from "@/lib/telegram-webapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = await readJson(request, "Не удалось прочитать заявку");
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Не удалось прочитать заявку" }, { status: 400 });
  }
  const source = body as Record<string, unknown>;
  const base = {
    medicId: Number(source.medicId),
    date: String(source.date ?? ""),
    time: String(source.time ?? ""),
    clientName: String(source.clientName ?? ""),
    clientPhone: String(source.clientPhone ?? ""),
  };
  if (source.source === "telegram") {
    const telegramUserId = typeof source.telegramUserId === "string" ? source.telegramUserId : "";
    const initData = typeof source.initData === "string" ? source.initData : "";
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
    const verified = telegramUserIdFromInitData(initData, token);
    if (!isTelegramUserId(telegramUserId) || !verified || verified !== telegramUserId) {
      return Response.json({ error: "Не удалось подтвердить Telegram. Откройте запись из бота." }, { status: 400 });
    }
    const result = await createAppointment({ ...base, source: "telegram", telegramUserId: verified });
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
    return Response.json({ appointment: result.appointment });
  }
  const result = await createAppointment({ ...base, source: "site" });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ appointment: result.appointment });
}
