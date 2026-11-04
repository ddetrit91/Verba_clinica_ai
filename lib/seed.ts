import type Database from "better-sqlite3";
import { addDays, localStamp, slotTimes, todayIso, weekdayOf } from "./format";

type SeedMedic = {
  name: string;
  specialty: string;
  slotMinutes: number;
  schedule: { weekday: number; start: string; end: string }[];
  target: number;
};

const SEED_MEDICS: SeedMedic[] = [
  {
    name: "Анна Соколова",
    specialty: "терапевт",
    slotMinutes: 30,
    target: 3,
    schedule: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: "09:00", end: "17:00" })),
  },
  {
    name: "Илья Морозов",
    specialty: "кардиолог",
    slotMinutes: 30,
    target: 6,
    schedule: [1, 3, 5].map((weekday) => ({ weekday, start: "10:00", end: "16:00" })),
  },
  {
    name: "Мария Лебедева",
    specialty: "невролог",
    slotMinutes: 30,
    target: 3,
    schedule: [
      { weekday: 2, start: "09:00", end: "15:00" },
      { weekday: 4, start: "09:00", end: "15:00" },
      { weekday: 6, start: "10:00", end: "14:00" },
    ],
  },
  {
    name: "Павел Орлов",
    specialty: "отоларинголог",
    slotMinutes: 30,
    target: 3,
    schedule: [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start: "08:00", end: "14:00" })),
  },
  {
    name: "Елена Крылова",
    specialty: "дерматолог",
    slotMinutes: 30,
    target: 3,
    schedule: [2, 3, 4, 5, 6].map((weekday) => ({ weekday, start: "12:00", end: "19:00" })),
  },
  {
    name: "Сергей Волков",
    specialty: "педиатр",
    slotMinutes: 30,
    target: 2,
    schedule: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: "09:00", end: "13:00" })),
  },
];

const PEOPLE: [string, string][] = [
  ["Ольга Никитина", "901112233"],
  ["Денис Кравцов", "902223344"],
  ["Марина Елисеева", "903334455"],
  ["Артём Белов", "904445566"],
  ["Кира Савельева", "905556677"],
  ["Глеб Тихонов", "906667788"],
  ["Нина Фролова", "907778899"],
  ["Роман Щукин", "908889900"],
  ["Алина Гордеева", "911112233"],
  ["Пётр Яшин", "912223344"],
  ["Светлана Озерова", "913334455"],
  ["Тимур Лапин", "914445566"],
  ["Ева Миронова", "915556677"],
  ["Вадим Сухарев", "916667788"],
  ["Людмила Репина", "917778899"],
  ["Ярослав Котов", "918889900"],
  ["Инга Беляева", "931112233"],
  ["Максим Рыжов", "932223344"],
  ["Тамара Щербакова", "933334455"],
  ["Игорь Лавров", "934445566"],
];

export function seed(db: Database.Database) {
  const count = db.prepare("SELECT COUNT(*) AS count FROM medics").get() as { count: number };
  if (count.count > 0) return;

  const insertMedic = db.prepare(
    "INSERT INTO medics (name, specialty, slot_minutes, active) VALUES (?, ?, ?, 1)",
  );
  const insertSchedule = db.prepare(
    "INSERT INTO schedules (medic_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?)",
  );
  const insertAppointment = db.prepare(
    `INSERT INTO appointments
      (medic_id, date, time, client_name, client_phone, source, telegram_user_id, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'booked', ?)`,
  );

  const today = todayIso();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let personIndex = 0;
  let appointments = 0;

  const fill = db.transaction(() => {
    for (const medic of SEED_MEDICS) {
      const result = insertMedic.run(medic.name, medic.specialty, medic.slotMinutes);
      const medicId = Number(result.lastInsertRowid);
      for (const interval of medic.schedule) {
        insertSchedule.run(medicId, interval.weekday, interval.start, interval.end);
      }

      const buckets: { date: string; time: string }[][] = [];
      for (let offset = 0; offset < 10; offset += 1) {
        const date = addDays(today, offset);
        const weekday = weekdayOf(date);
        const interval = medic.schedule.find((item) => item.weekday === weekday);
        if (!interval) continue;
        const times = slotTimes(interval.start, interval.end, medic.slotMinutes).filter((time) => {
          if (date > today) return true;
          const [hours, minutes] = time.split(":").map(Number);
          return hours * 60 + minutes > nowMinutes;
        });
        if (times.length > 0) buckets.push(times.map((time) => ({ date, time })));
      }

      const picked: { date: string; time: string }[] = [];
      while (picked.length < medic.target) {
        let progressed = false;
        for (const bucket of buckets) {
          const next = bucket.shift();
          if (!next) continue;
          picked.push(next);
          progressed = true;
          if (picked.length >= medic.target) break;
        }
        if (!progressed) break;
      }

      for (const slot of picked) {
        const [name, phone] = PEOPLE[personIndex % PEOPLE.length];
        personIndex += 1;
        const fromTelegram = personIndex % 5 === 0;
        insertAppointment.run(
          medicId,
          slot.date,
          slot.time,
          name,
          `+998${phone}`,
          fromTelegram ? "telegram" : "site",
          fromTelegram ? String(5000 + personIndex) : null,
          localStamp(),
        );
        appointments += 1;
      }
    }
  });

  fill();
  console.info(`Сиды клиники «Верба»: ${SEED_MEDICS.length} медиков, ${appointments} заявок`);
}
