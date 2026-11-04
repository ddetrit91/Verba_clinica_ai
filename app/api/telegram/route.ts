import { webhookCallback } from "grammy";
import { waitUntil } from "@vercel/functions";
import { createBot } from "@/lib/telegram-bot";
import { webhookSecret } from "@/lib/telegram-endpoint";
import { runDueReminders } from "@/lib/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function bot() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error("Нет TELEGRAM_BOT_TOKEN");
  return createBot(token);
}

export async function POST(request: Request) {
  const handle = webhookCallback(bot(), "std/http", { secretToken: webhookSecret() });
  const response = await handle(request);
  if (response.ok) {
    waitUntil(runDueReminders().catch((error: unknown) => console.error("Напоминания", error)));
  }
  return response;
}
