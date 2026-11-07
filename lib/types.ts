export type ScheduleInterval = {
  weekday: number;
  start: string;
  end: string;
};

export type Medic = {
  id: number;
  name: string;
  specialty: string;
  slotMinutes: number;
  photo: string | null;
  schedule: ScheduleInterval[];
};

export type DayCell = {
  date: string;
  past: boolean;
  working: boolean;
  free: number;
  total: number;
};

export type Slot = {
  time: string;
  taken: boolean;
};

export type Appointment = {
  id: number;
  medicId: number;
  medicName: string;
  specialty: string;
  date: string;
  time: string;
  clientName: string;
  clientPhone: string;
  source: "site" | "telegram";
  telegramUserId: string | null;
  status: "booked" | "cancelled";
  createdAt: string;
};

export type MedicInput = {
  name: string;
  specialty: string;
  slotMinutes: number;
  schedule: ScheduleInterval[];
};
