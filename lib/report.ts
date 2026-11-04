import { appointmentsBetween } from "./appointments";
import { addDays, todayIso } from "./format";
import { listMedics } from "./medics";
import { scheduleSlotCount } from "./slots";

export async function loadReport() {
  const today = todayIso();
  const until = addDays(today, 6);
  const medics = await Promise.all(
    (await listMedics()).map(async (medic) => {
      let total = 0;
      for (let offset = 0; offset < 7; offset += 1) {
        total += scheduleSlotCount(medic, addDays(today, offset), { hidePast: false });
      }
      const bookedRows = await appointmentsBetween(medic.id, today, until);
      const booked = bookedRows.length;
      return {
        ...medic,
        booked,
        total,
        occupancy: total === 0 ? 0 : Math.round((booked / total) * 100),
        todayAppointments: bookedRows.filter((item) => item.date === today),
      };
    }),
  );
  return {
    today,
    medics,
    todayAppointments: await appointmentsBetween(null, today, today),
  };
}
