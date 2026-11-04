import { appointmentsBetween } from "./appointments";
import { addDays, todayIso } from "./format";
import { listMedics } from "./medics";
import { daySlots } from "./slots";

export function loadReport() {
  const today = todayIso();
  const until = addDays(today, 6);
  const medics = listMedics().map((medic) => {
    let total = 0;
    for (let offset = 0; offset < 7; offset += 1) {
      total += daySlots(medic.id, addDays(today, offset), { hidePast: false }).length;
    }
    const bookedRows = appointmentsBetween(medic.id, today, until);
    const booked = bookedRows.length;
    return {
      ...medic,
      booked,
      total,
      occupancy: total === 0 ? 0 : Math.round((booked / total) * 100),
      todayAppointments: bookedRows.filter((item) => item.date === today),
    };
  });
  return {
    today,
    medics,
    todayAppointments: appointmentsBetween(null, today, today),
  };
}
