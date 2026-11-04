import { parseMedicInput, updateMedic } from "@/lib/medics";
import { readJson, requireAdmin } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await context.params;
  const medicId = Number(id);
  if (!Number.isInteger(medicId)) return Response.json({ error: "Медик не найден" }, { status: 404 });
  const parsedBody = await readJson(request);
  if (!parsedBody.ok) return parsedBody.response;
  const parsed = parseMedicInput(parsedBody.value);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const medic = updateMedic(medicId, parsed.value);
  if (!medic) return Response.json({ error: "Медик не найден" }, { status: 404 });
  return Response.json({ medic });
}
