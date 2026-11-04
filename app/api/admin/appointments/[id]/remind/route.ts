import { requireAdmin } from "@/lib/http";
import { sendManualReminder } from "@/lib/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await context.params;
  const appointmentId = Number(id);
  if (!Number.isInteger(appointmentId)) {
    return Response.json({ error: "Заявка не найдена" }, { status: 404 });
  }
  const result = await sendManualReminder(appointmentId);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ ok: true });
}
