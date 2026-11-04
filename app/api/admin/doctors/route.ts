import { createMedic, parseMedicInput } from "@/lib/medics";
import { readJson, requireAdmin } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsedBody = await readJson(request);
  if (!parsedBody.ok) return parsedBody.response;
  const parsed = parseMedicInput(parsedBody.value);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  return Response.json({ medic: createMedic(parsed.value) });
}
