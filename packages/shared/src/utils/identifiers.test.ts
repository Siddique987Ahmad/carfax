import { describe, expect, it } from 'vitest';
import { normaliseChassisNo, normaliseRegNo } from './identifiers';

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
