import { isAdmin } from "./session";

export async function readJson(
  request: Request,
  error = "Пустая форма",
  status = 400,
): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false, response: Response.json({ error }, { status }) };
  }
}

export async function requireAdmin(): Promise<Response | null> {
  if (await isAdmin()) return null;
  return Response.json({ error: "Нужен вход" }, { status: 401 });
}
