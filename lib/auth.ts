import { createHash, createHmac, timingSafeEqual } from "crypto";

export const ADMIN_COOKIE = "verba_admin";
const WEEK = 60 * 60 * 24 * 7;

function secret(): string {
  const value = process.env.ADMIN_SECRET?.trim();
  if (!value) throw new Error("Нужен ADMIN_SECRET в .env");
  return value;
}

export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD?.trim() ?? "";
  if (!expected || !input) return false;
  const actualHash = createHash("sha256").update(input).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

export function signSession(): string {
  const expires = Date.now() + WEEK * 1000;
  const payload = `admin.${expires}`;
  const signature = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

export function verifySession(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [role, expires, signature] = parts;
  if (role !== "admin") return false;
  if (!/^\d+$/.test(expires) || Number(expires) < Date.now()) return false;
  let expected: string;
  try {
    expected = createHmac("sha256", secret()).update(`${role}.${expires}`).digest("hex");
  } catch {
    return false;
  }
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}
