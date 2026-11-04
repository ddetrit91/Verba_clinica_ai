import { one, tx } from "./db";

export type Step =
  | { kind: "idle" }
  | { kind: "name"; medicId: number; date: string; time: string }
  | { kind: "phone"; medicId: number; date: string; time: string; name: string };

export type SessionData = { step: Step };

export function emptySession(): SessionData {
  return { step: { kind: "idle" } };
}

export function postgresSessionStorage() {
  return {
    async read(key: string): Promise<SessionData | undefined> {
      const row = await one<{ value: SessionData }>("SELECT value FROM bot_sessions WHERE key = ?", [key]);
      const value = row?.value;
      if (!value) return undefined;
      if (typeof value === "string") return JSON.parse(value) as SessionData;
      if (typeof value === "object") return value;
      return undefined;
    },
    async write(key: string, value: SessionData): Promise<void> {
      await tx(async (db) => {
        await db.query(
          `INSERT INTO bot_sessions (key, value, updated_at) VALUES ($1, $2::jsonb, now())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
          [key, JSON.stringify(value)],
        );
      });
    },
    async delete(key: string): Promise<void> {
      await tx(async (db) => {
        await db.query("DELETE FROM bot_sessions WHERE key = $1", [key]);
      });
    },
  };
}
