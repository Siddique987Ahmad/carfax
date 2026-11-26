// Normalisation for the numbers people type, scan or read off documents.
// The garage app, API, admin panel and website all use these, so the same car is always found.

/** Urdu (Extended Arabic-Indic) and Arabic-Indic digits to ASCII: '۱۲۳' -> '123'. */
function toAsciiDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (d) =>
    String((d.charCodeAt(0) - (d >= '۰' ? 0x06f0 : 0x0660)) % 10),
  );
}

function toKey(input: string): string {
  return toAsciiDigits(input)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Normalise a number plate for storage and search: upper case, Urdu digits to ASCII,
 * spaces, dashes and dots removed. 'lea-1234', 'LEA 1234' and 'LEA–۱۲۳۴' all become 'LEA1234'.
 * Returns null if the result can't be a plate (needs at least one letter and one digit, 3–15 characters).
 *
 * The registration year is not part of the plate here; it's stored separately (cars.reg_year, db/04),
 * pending the open question in admin/11 about whether plates repeat across years.
 */
export function normaliseRegNo(input: string): string | null {
  const key = toKey(input);
  if (key.length < 3 || key.length > 15) return null;
  if (!/[A-Z]/.test(key) || !/[0-9]/.test(key)) return null;
  return key;
}

/**
 * Normalise a chassis number (a 17-character VIN, or a Japanese frame number like 'NZE161-0123456'):
 * upper case, Urdu digits to ASCII, spaces and dashes removed. Returns null if it's 6–30 characters
 * without a digit, or outside that length.
 */
export function normaliseChassisNo(input: string): string | null {
  const key = toKey(input);
  if (key.length < 6 || key.length > 30) return null;
  if (!/[0-9]/.test(key)) return null;
  return key;
}
