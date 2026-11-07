export const MEDIC_PHOTOS: Record<string, string> = {
  "Анна Соколова": "/medics/anna-sokolova.jpg",
  "Илья Морозов": "/medics/ilya-morozov.jpg",
  "Мария Лебедева": "/medics/maria-lebedeva.jpg",
  "Павел Орлов": "/medics/pavel-orlov.jpg",
  "Елена Крылова": "/medics/elena-krylova.jpg",
  "Сергей Волков": "/medics/sergey-volkov.jpg",
};

export function photoForMedic(name: string): string | null {
  return MEDIC_PHOTOS[name] ?? null;
}
