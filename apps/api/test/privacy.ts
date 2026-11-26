import { redactPhoneNumbers } from '@carfax/shared';

/**
 * Finds personal data in a response body (api/02): any Pakistani mobile number in any spelling,
 * or one of the given names. Public responses (reports, search, health) must never contain either.
 */
export function findPersonalData(body: unknown, names: readonly string[]): string[] {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const found: string[] = [];
  if (redactPhoneNumbers(text) !== text) found.push('a phone number');
  for (const name of names) {
    if (text.toLowerCase().includes(name.toLowerCase())) found.push(`the name "${name}"`);
  }
  return found;
}
