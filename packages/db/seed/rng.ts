/**
 * A small seeded random generator (mulberry32). The same seed gives the same data every run,
 * including ids, so a bug seen on seeded data can be reproduced exactly.
 */
export function createRng(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!;
  const chance = (p: number) => next() < p;
  /** Picks by weight: weighted([['a', 3], ['b', 1]]) gives 'a' three times as often. */
  const weighted = <T>(pairs: readonly (readonly [T, number])[]): T => {
    let r = next() * pairs.reduce((sum, [, w]) => sum + w, 0);
    for (const [value, weight] of pairs) {
      r -= weight;
      if (r < 0) return value;
    }
    return pairs[pairs.length - 1]![0];
  };
  /** A random (version 4) UUID drawn from this generator, so it's the same every run. */
  const uuid = () => {
    const hex = Array.from({ length: 32 }, () => int(0, 15).toString(16));
    hex[12] = '4';
    hex[16] = ((int(0, 15) & 0x3) | 0x8).toString(16);
    const h = hex.join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  };
  const digits = (count: number) => Array.from({ length: count }, () => int(0, 9)).join('');
  const letters = (count: number, from = 'ABCDEFGHJKLMNPRSTUVWXYZ') =>
    Array.from({ length: count }, () => pick([...from])).join('');
  return { next, int, pick, chance, weighted, uuid, digits, letters };
}

export type Rng = ReturnType<typeof createRng>;

/** Dates relative to an anchor day, so queues (due reminders, recent jobs) always look current. */
export const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);
export const isoDate = (date: Date) => date.toISOString().slice(0, 10);
