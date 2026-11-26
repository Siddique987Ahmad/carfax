import { describe, expect, it } from 'vitest';
import {
  normaliseChassisNo,
  normalisePakistanMobile,
  normaliseRegNo,
  PAKISTAN_MOBILE_PATTERN,
} from './identifiers';

describe('normaliseRegNo', () => {
  it.each([
    ['LEA-1234', 'LEA1234'],
    ['lea 1234', 'LEA1234'],
    ['  LEA   1234 ', 'LEA1234'],
    ['LEA–1234', 'LEA1234'], // en dash, common when copied from documents
    ['L.E.A-1234', 'LEA1234'],
    ['LEA-۱۲۳۴', 'LEA1234'], // Urdu digits
    ['LEA-١٢٣٤', 'LEA1234'], // Arabic-Indic digits
    ['AFR-123', 'AFR123'],
    ['ict 9876', 'ICT9876'],
    ['A-1234 PSR', 'A1234PSR'],
  ])('%s -> %s', (input, expected) => {
    expect(normaliseRegNo(input)).toBe(expected);
  });

  it.each([[''], ['   '], ['1234'], ['LEA'], ['--'], ['A1'], ['ABCDEFGH12345678']])(
    'rejects %j',
    (input) => {
      expect(normaliseRegNo(input)).toBeNull();
    },
  );
});

describe('normaliseChassisNo', () => {
  it.each([
    ['NZE161-0123456', 'NZE1610123456'],
    ['nze161 0123456', 'NZE1610123456'],
    ['JTDBR32E720123456', 'JTDBR32E720123456'],
    ['ZRE172-۰۰۱۲۳۴', 'ZRE172001234'],
  ])('%s -> %s', (input, expected) => {
    expect(normaliseChassisNo(input)).toBe(expected);
  });

  it.each([[''], ['ABC12'], ['ABCDEFGH'], ['X'.repeat(29) + '12']])('rejects %j', (input) => {
    expect(normaliseChassisNo(input)).toBeNull();
  });
});

describe('normalisePakistanMobile', () => {
  it.each([
    ['03001234567', '+923001234567'],
    ['0300-1234567', '+923001234567'],
    ['0300 123 4567', '+923001234567'],
    ['+92 300 1234567', '+923001234567'],
    ['+92-300-1234567', '+923001234567'],
    ['923001234567', '+923001234567'],
    ['00923001234567', '+923001234567'],
    ['3001234567', '+923001234567'],
    ['۰۳۰۰۱۲۳۴۵۶۷', '+923001234567'],
  ])('%s -> %s', (input, expected) => {
    const result = normalisePakistanMobile(input);
    expect(result).toBe(expected);
    expect(result).toMatch(PAKISTAN_MOBILE_PATTERN);
  });

  it.each([
    [''],
    ['042-35761234'], // Lahore landline
    ['0300123456'], // one digit short
    ['030012345678'], // one digit long
    ['+44 7700 900123'], // UK
    ['abc'],
  ])('rejects %j', (input) => {
    expect(normalisePakistanMobile(input)).toBeNull();
  });
});
