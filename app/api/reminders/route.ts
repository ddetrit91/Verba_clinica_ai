import { runDueReminders } from "@/lib/reminders";
import { webhookSecret } from "@/lib/telegram-endpoint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function allowed(request: Request): boolean {
  if (request.headers.get("x-vercel-cron") === "1") return true;
  const header = request.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && header === `Bearer ${secret}`) return true;
  try {
    return header === `Bearer ${webhookSecret()}`;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  if (!allowed(request)) return Response.json({ error: "Нет доступа" }, { status: 401 });
  await runDueReminders();
  return Response.json({ ok: true });
}
