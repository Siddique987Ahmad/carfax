/**
 * Cities a garage can be in (api/05). A fixed list keeps spelling consistent for reports, search
 * and the per-city coverage gate (product doc, Gate 3). Add cities as the product expands.
 */
export const CITIES = [
  'Lahore',
  'Karachi',
  'Islamabad',
  'Rawalpindi',
  'Faisalabad',
  'Multan',
  'Gujranwala',
  'Peshawar',
  'Quetta',
  'Sialkot',
  'Hyderabad',
  'Sargodha',
  'Bahawalpur',
  'Gujrat',
  'Sheikhupura',
] as const;

export type City = (typeof CITIES)[number];
