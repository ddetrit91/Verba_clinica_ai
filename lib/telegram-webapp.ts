import { createHmac, timingSafeEqual } from "crypto";

const MAX_AGE_SEC = 60 * 60 * 24;

export function isTelegramUserId(value: string): boolean {
  return /^\d{1,20}$/.test(value);
}

/** Проверяет подпись initData Mini App и возвращает id пользователя из подписанных данных. */
export function telegramUserIdFromInitData(initData: string, botToken: string): string | null {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash) || !Number.isFinite(authDate)) return null;
  const now = Math.floor(Date.now() / 1000);
  if (authDate > now + 60 || now - authDate > MAX_AGE_SEC) return null;

  const pairs: string[] = [];
  params.forEach((value, key) => {
    if (key === "hash") return;
    pairs.push(`${key}=${value}`);
  });
  pairs.sort();

  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculated = createHmac("sha256", secret).update(pairs.join("\n")).digest("hex");
  const left = Buffer.from(calculated, "hex");
  const right = Buffer.from(hash, "hex");
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  const userRaw = params.get("user");
  if (!userRaw) return null;
  try {
    const user = JSON.parse(userRaw) as { id?: unknown };
    const id = typeof user.id === "number" || typeof user.id === "string" ? String(user.id) : "";
    return isTelegramUserId(id) ? id : null;
  } catch {
    return null;
  }
}
