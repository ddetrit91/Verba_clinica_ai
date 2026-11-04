import { listMedics } from "@/lib/medics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ medics: await listMedics() });
}
