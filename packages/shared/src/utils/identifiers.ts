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

/**
 * Normalise a Pakistani mobile number to the stored login format '+923XXXXXXXXX' (users.phone, db/02).
 * Accepts '0300 1234567', '0300-1234567', '+92 300 1234567', '923001234567', '00923001234567',
 * '3001234567' and Urdu digits. Returns null for anything that isn't a Pakistani mobile number
 * (landlines and foreign numbers can't receive the login code).
 */
export function normalisePakistanMobile(input: string): string | null {
  const digits = toAsciiDigits(input).replace(/[^0-9]/g, '');
  const national = digits.startsWith('0092')
    ? digits.slice(4)
    : digits.startsWith('92')
      ? digits.slice(2)
      : digits.startsWith('0')
        ? digits.slice(1)
        : digits;
  return /^3[0-9]{9}$/.test(national) ? `+92${national}` : null;
}

/** The stored mobile format, also enforced by a CHECK on users.phone. */
export const PAKISTAN_MOBILE_PATTERN = /^\+923[0-9]{9}$/;

/**
 * Pakistani mobile numbers in free text, in any common spelling: +923001234567, 923001234567,
 * 00923001234567, 03001234567, 0300-1234567, 0300 1234567, +92 300 1234567.
 */
const PHONE_IN_TEXT = /(?<![\dA-Za-z])(?:(?:\+|00)?92[\s-]?|0)?3\d{2}[\s-]?\d{7}(?!\d)/g;

/**
 * Replaces Pakistani mobile numbers in text with '[phone]'. For logs and error reports, where a
 * number can slip in through an error message (e.g. Postgres: "Key (phone)=(+92300…) already exists").
 */
export function redactPhoneNumbers(text: string): string {
  return text.replace(PHONE_IN_TEXT, '[phone]');
}
