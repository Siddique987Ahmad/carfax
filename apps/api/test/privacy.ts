import { redactPhoneNumbers } from '@carfax/shared';

/**
 * Finds personal data in a response body (api/02). By default: any Pakistani mobile number in any
 * spelling, or one of the given names; public responses must never contain either. With `phones`,
 * looks only for those numbers (in any spelling), for signed-in responses that may legitimately
 * show other numbers, such as an owner's own staff list (api/11).
 */
export function findPersonalData(
  body: unknown,
  names: readonly string[],
  phones?: readonly string[],
): string[] {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const found: string[] = [];
  if (phones) {
    const digits = text.replace(/\D/g, '');
    for (const phone of phones) {
      const national = phone.replace(/\D/g, '').replace(/^92/, ''); // 3001234567
      if (digits.includes(national)) found.push(`the phone ${phone}`);
    }
  } else if (redactPhoneNumbers(text) !== text) {
    found.push('a phone number');
  }
  for (const name of names) {
    if (text.toLowerCase().includes(name.toLowerCase())) found.push(`the name "${name}"`);
  }
  return found;
}
