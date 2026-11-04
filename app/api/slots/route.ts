import { getMedic } from "@/lib/medics";
import { daySlots } from "@/lib/slots";
import { isIsoDate } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const medicId = Number(url.searchParams.get("medicId"));
  const date = url.searchParams.get("date") ?? "";
  if (!Number.isInteger(medicId) || !isIsoDate(date)) {
    return Response.json({ error: "Нужны медик и день" }, { status: 400 });
  }
  if (!(await getMedic(medicId))) return Response.json({ error: "Медик не найден" }, { status: 404 });
  return Response.json({ slots: await daySlots(medicId, date) });
}
