import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../logger';

// Mock Sentry's captureException
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// Mock console methods
let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}); // Mock warn to avoid cluttering test output
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call console.debug for debug messages', () => {
    logger.debug('debug message', { key: 'value' });
    expect(consoleDebugSpy).toHaveBeenCalledTimes(1); // Ensure it was called once
    expect(consoleDebugSpy).toHaveBeenCalledWith('debug message', { key: 'value' }); // Ensure it was called with correct args
  });

  it('should call console.info for info messages', () => {
    logger.info('info message', 123);
    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    expect(consoleInfoSpy).toHaveBeenCalledWith('info message', 123);
  });

  it('should call console.warn for warn messages', () => {
    logger.warn('warn message');
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith('warn message');
  });
});
