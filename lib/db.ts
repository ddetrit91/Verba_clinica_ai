import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { seed } from "./seed";

function ensureColumn(db: Database.Database, name: string, definition: string) {
  const columns = db.prepare("PRAGMA table_info(appointments)").all() as { name: string }[];
  if (columns.some((column) => column.name === name)) return;
  db.exec(`ALTER TABLE appointments ADD COLUMN ${definition}`);
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS medics (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      specialty TEXT NOT NULL,
      slot_minutes INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY,
      medic_id INTEGER NOT NULL REFERENCES medics(id) ON DELETE CASCADE,
      weekday INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      UNIQUE (medic_id, weekday)
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY,
      medic_id INTEGER NOT NULL REFERENCES medics(id),
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      client_name TEXT NOT NULL,
      client_phone TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('site', 'telegram')),
      telegram_user_id TEXT,
      status TEXT NOT NULL CHECK (status IN ('booked', 'cancelled')) DEFAULT 'booked',
      created_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS appointments_slot_active
      ON appointments (medic_id, date, time)
      WHERE status = 'booked';
  `);
  ensureColumn(db, "reminder_hour_sent", "reminder_hour_sent INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "reminder_soon_sent", "reminder_soon_sent INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "reminder_hour_tries", "reminder_hour_tries INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "reminder_soon_tries", "reminder_soon_tries INTEGER NOT NULL DEFAULT 0");
  db.exec(`
    UPDATE appointments
    SET client_phone = '+998' || substr(client_phone, 3, 9)
    WHERE client_phone LIKE '+7%';
  `);
}

const globalDb = globalThis as unknown as { verbaDb?: Database.Database };

export function getDb(): Database.Database {
  if (!globalDb.verbaDb) {
    const dir = path.join(process.cwd(), "data");
    fs.mkdirSync(dir, { recursive: true });
    const db = new Database(path.join(dir, "clinic.sqlite"));
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");
    migrate(db);
    seed(db);
    globalDb.verbaDb = db;
  }
  return globalDb.verbaDb;
}
