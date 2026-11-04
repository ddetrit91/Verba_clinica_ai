import { getMedic } from "@/lib/medics";
import { monthAvailability } from "@/lib/slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const url = new URL(request.url);
  const medicId = Number(url.searchParams.get("medicId"));
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));
  if (!Number.isInteger(medicId) || !Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return Response.json({ error: "Нужны медик, год и месяц" }, { status: 400 });
  }
  if (!getMedic(medicId)) return Response.json({ error: "Медик не найден" }, { status: 404 });
  return Response.json({ days: monthAvailability(medicId, year, month) });
}
