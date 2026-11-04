import type { Appointment, Medic, ScheduleInterval } from "./types";

export type AppointmentRow = {
  id: number;
  medic_id: number;
  medic_name: string;
  specialty: string;
  date: string;
  time: string;
  client_name: string;
  client_phone: string;
  source: "site" | "telegram";
  telegram_user_id: string | null;
  status: "booked" | "cancelled";
  created_at: string;
};

export type MedicRow = {
  id: number;
  name: string;
  specialty: string;
  slot_minutes: number;
};

export const APPOINTMENT_SELECT = `SELECT a.id, a.medic_id, m.name AS medic_name, m.specialty, a.date, a.time,
        a.client_name, a.client_phone, a.source, a.telegram_user_id, a.status, a.created_at
 FROM appointments a
 JOIN medics m ON m.id = a.medic_id`;

export function mapAppointment(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    medicId: row.medic_id,
    medicName: row.medic_name,
    specialty: row.specialty,
    date: row.date,
    time: row.time,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    source: row.source,
    telegramUserId: row.telegram_user_id,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function mapMedic(row: MedicRow, schedule: ScheduleInterval[]): Medic {
  return {
    id: row.id,
    name: row.name,
    specialty: row.specialty,
    slotMinutes: row.slot_minutes,
    schedule,
  };
}
