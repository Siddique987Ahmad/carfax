import enCommon from './locales/en/common.json';
import enWorkTypes from './locales/en/workTypes.json';
import urCommon from './locales/ur/common.json';
import urWorkTypes from './locales/ur/workTypes.json';

export const LOCALES = ['en', 'ur'] as const;
export type Locale = (typeof LOCALES)[number];

/** English is the source: every key must exist in English first. One JSON file per feature. */
const en = { common: enCommon, workTypes: enWorkTypes };
export type Messages = typeof en;

/** Urdu must have the same shape as English; a missing key fails type-check and the i18n test. */
const ur: Messages = { common: urCommon, workTypes: urWorkTypes };

export const messages: Record<Locale, Messages> = { en, ur };

/** Every dotted key, e.g. 'common.sync.synced' or 'workTypes.oil_change'. */
export type MessageKey = DottedKeys<Messages>;
type DottedKeys<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${DottedKeys<T[K]>}`;
}[keyof T & string];

/** Translate a key, filling {placeholders}: t('ur', 'common.sync.pending', { count: 3 }). */
export function t(
  locale: Locale,
  key: MessageKey,
  params: Record<string, string | number> = {},
): string {
  let node: unknown = messages[locale];
  for (const part of key.split('.')) {
    node = (node as Record<string, unknown>)[part];
  }
  if (typeof node !== 'string') throw new Error(`Missing translation: ${locale}.${key}`);
  return node.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Text direction for a locale. Urdu is right-to-left. */
export function dir(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ur' ? 'rtl' : 'ltr';
}
