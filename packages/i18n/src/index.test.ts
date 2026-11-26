import { WORK_TYPES } from '@carfax/shared';
import { describe, expect, it } from 'vitest';
import { dir, LOCALES, messages, t } from './index';

/** Every dotted key path in a messages object, with its value. */
function flatten(node: unknown, prefix = ''): Map<string, unknown> {
  const out = new Map<string, unknown>();
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object') {
        for (const [k, v] of flatten(value, path)) out.set(k, v);
      } else {
        out.set(path, value);
      }
    }
  }
  return out;
}

const english = flatten(messages.en);

describe('translations', () => {
  for (const locale of LOCALES) {
    const other = flatten(messages[locale]);

    it(`${locale}: has every English key, as non-empty text`, () => {
      const missing = [...english.keys()].filter((k) => {
        const value = other.get(k);
        return typeof value !== 'string' || value.trim() === '';
      });
      expect(missing).toEqual([]);
    });

    it(`${locale}: has no keys that English lacks`, () => {
      expect([...other.keys()].filter((k) => !english.has(k))).toEqual([]);
    });

    it(`${locale}: keeps the same {placeholders} as English`, () => {
      const placeholders = (s: unknown) =>
        String(s)
          .match(/\{\w+\}/g)
          ?.sort() ?? [];
      const wrong = [...english.keys()].filter(
        (k) => placeholders(english.get(k)).join() !== placeholders(other.get(k)).join(),
      );
      expect(wrong).toEqual([]);
    });
  }

  it('has a label for every work type in @carfax/shared', () => {
    for (const locale of LOCALES) {
      for (const code of WORK_TYPES) {
        expect(messages[locale].workTypes[code], `${locale}.workTypes.${code}`).toBeTruthy();
      }
    }
  });
});

describe('t and dir', () => {
  it('fills placeholders', () => {
    expect(t('en', 'common.sync.pending', { count: 3 })).toBe('3 waiting to upload');
    expect(t('ur', 'common.sync.pending', { count: 3 })).toBe('3 اپ لوڈ کے منتظر');
  });

  it('marks Urdu as right-to-left', () => {
    expect(dir('ur')).toBe('rtl');
    expect(dir('en')).toBe('ltr');
  });
});
