import { cookies } from "next/headers";
import { ADMIN_COOKIE, checkPassword, signSession } from "@/lib/auth";
import { readJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = await readJson(request, "Неверный пароль", 401);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value as { password?: string };
  if (!checkPassword(String(body?.password ?? ""))) {
    return Response.json({ error: "Неверный пароль" }, { status: 401 });
  }
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, signSession(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === "production",
  });
  return Response.json({ ok: true });
}
