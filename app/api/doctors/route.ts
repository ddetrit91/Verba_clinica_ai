import { listMedics } from "@/lib/medics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ medics: listMedics() });
}
