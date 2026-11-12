import { afterEach, describe, expect, test } from 'vitest';

import { parseFiniteEnvNumber } from './config';

const ENV_NAME = 'NEXT_PUBLIC_TEST_NUMBER';

describe('parseFiniteEnvNumber', () => {
  afterEach(() => {
    delete process.env[ENV_NAME];
  });

  test('uses fallback when env is missing or empty', () => {
    delete process.env[ENV_NAME];
    expect(parseFiniteEnvNumber(ENV_NAME, 42)).toBe(42);

    process.env[ENV_NAME] = '';
    expect(parseFiniteEnvNumber(ENV_NAME, 42)).toBe(42);
  });

  test('parses finite number strings', () => {
    process.env[ENV_NAME] = '123.5';

    expect(parseFiniteEnvNumber(ENV_NAME, 42)).toBe(123.5);
  });

  test('preserves zero and negative values', () => {
    process.env[ENV_NAME] = '0';
    expect(parseFiniteEnvNumber(ENV_NAME, 42)).toBe(0);

    process.env[ENV_NAME] = '-1';
    expect(parseFiniteEnvNumber(ENV_NAME, 42)).toBe(-1);
  });

  test('throws on non-finite values', () => {
    for (const value of ['abc', 'NaN', 'Infinity']) {
      process.env[ENV_NAME] = value;
      expect(() => parseFiniteEnvNumber(ENV_NAME, 42)).toThrow(
        `${ENV_NAME} must be a finite number`,
      );
    }
  });
});
