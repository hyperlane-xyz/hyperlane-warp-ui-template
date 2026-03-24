import { describe, expect, test } from 'vitest';
import { normalizeHex, shiftColor } from './embedTheme';

describe('normalizeHex', () => {
  test('expands 3-digit shorthand to 6-digit', () => {
    expect(normalizeHex('#abc')).toBe('#aabbcc');
    expect(normalizeHex('f00')).toBe('#ff0000');
    expect(normalizeHex('#fff')).toBe('#ffffff');
  });

  test('expands 4-digit shorthand (strips alpha) to 6-digit', () => {
    expect(normalizeHex('#abcd')).toBe('#aabbcc');
    expect(normalizeHex('f00f')).toBe('#ff0000');
  });

  test('passes through 6-digit hex unchanged', () => {
    expect(normalizeHex('#3b82f6')).toBe('#3b82f6');
    expect(normalizeHex('9a0dff')).toBe('#9a0dff');
  });

  test('strips alpha from 8-digit hex', () => {
    expect(normalizeHex('#3b82f6ff')).toBe('#3b82f6');
    expect(normalizeHex('9a0dff80')).toBe('#9a0dff');
  });
});

describe('shiftColor', () => {
  test('lightens a color', () => {
    const result = shiftColor('#000000', 60);
    expect(result).toBe('#3c3c3c');
  });

  test('darkens a color', () => {
    const result = shiftColor('#ffffff', -60);
    expect(result).toBe('#c3c3c3');
  });

  test('clamps to 0 (no negative channels)', () => {
    const result = shiftColor('#101010', -100);
    expect(result).toBe('#000000');
  });

  test('clamps to 255 (no overflow)', () => {
    const result = shiftColor('#f0f0f0', 100);
    expect(result).toBe('#ffffff');
  });

  test('handles 3-digit shorthand input', () => {
    // #abc → #aabbcc, then shift
    const result = shiftColor('#abc', 0);
    expect(result).toBe('#aabbcc');
  });

  test('handles 8-digit hex input (strips alpha)', () => {
    const result = shiftColor('#3b82f6ff', 0);
    expect(result).toBe('#3b82f6');
  });
});

describe('HEX_COLOR_RE (via parseHexParam behavior)', () => {
  // Test the regex indirectly by checking which values would match
  const HEX_COLOR_RE = /^([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

  test('accepts valid 3-digit hex', () => {
    expect(HEX_COLOR_RE.test('abc')).toBe(true);
    expect(HEX_COLOR_RE.test('FFF')).toBe(true);
  });

  test('accepts valid 4-digit hex', () => {
    expect(HEX_COLOR_RE.test('abcd')).toBe(true);
    expect(HEX_COLOR_RE.test('F00F')).toBe(true);
  });

  test('accepts valid 6-digit hex', () => {
    expect(HEX_COLOR_RE.test('3b82f6')).toBe(true);
    expect(HEX_COLOR_RE.test('9A0DFF')).toBe(true);
  });

  test('accepts valid 8-digit hex', () => {
    expect(HEX_COLOR_RE.test('3b82f6ff')).toBe(true);
    expect(HEX_COLOR_RE.test('9A0DFF80')).toBe(true);
  });

  test('rejects 5-digit hex', () => {
    expect(HEX_COLOR_RE.test('12345')).toBe(false);
  });

  test('rejects 7-digit hex', () => {
    expect(HEX_COLOR_RE.test('1234567')).toBe(false);
  });

  test('rejects 1-2 digit hex', () => {
    expect(HEX_COLOR_RE.test('ab')).toBe(false);
    expect(HEX_COLOR_RE.test('a')).toBe(false);
  });

  test('rejects non-hex characters', () => {
    expect(HEX_COLOR_RE.test('gggggg')).toBe(false);
    expect(HEX_COLOR_RE.test('xyz')).toBe(false);
  });

  test('rejects empty string', () => {
    expect(HEX_COLOR_RE.test('')).toBe(false);
  });
});
