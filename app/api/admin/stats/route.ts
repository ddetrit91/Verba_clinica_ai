import { requireAdmin } from "@/lib/http";
import { loadReport } from "@/lib/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return Response.json(await loadReport());
}
