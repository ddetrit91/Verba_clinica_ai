import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifySession } from "./auth";

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return verifySession(jar.get(ADMIN_COOKIE)?.value);
}
