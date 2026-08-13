import { describe, expect, it } from 'vitest';
import { HealthResponseSchema, PlayResponseSchema } from './schemas.js';

describe('PlayResponseSchema', () => {
  it('accepts a bare ok response', () => {
    expect(PlayResponseSchema.safeParse({ status: 'ok' })).toEqual({
      success: true,
      data: { status: 'ok' },
    });
  });

  it('accepts an error response with a message', () => {
    expect(PlayResponseSchema.safeParse({ status: 'error', message: 'mpv not found' })).toEqual({
      success: true,
      data: { status: 'error', message: 'mpv not found' },
    });
  });

  it('rejects an unknown status value', () => {
    expect(PlayResponseSchema.safeParse({ status: 'unknown' }).success).toBe(false);
  });

  it('rejects unexpected extra keys', () => {
    expect(PlayResponseSchema.safeParse({ status: 'ok', extra: true }).success).toBe(false);
  });

  it('rejects a non-string message', () => {
    expect(PlayResponseSchema.safeParse({ status: 'ok', message: 123 }).success).toBe(false);
  });

  it('rejects a non-object body', () => {
    expect(PlayResponseSchema.safeParse('nope').success).toBe(false);
  });
});

describe('HealthResponseSchema', () => {
  it('accepts the documented running status', () => {
    expect(HealthResponseSchema.safeParse({ status: 'running' })).toEqual({
      success: true,
      data: { status: 'running' },
    });
  });

  it('rejects any other status value', () => {
    expect(HealthResponseSchema.safeParse({ status: 'stopped' }).success).toBe(false);
  });

  it('rejects unexpected extra keys', () => {
    expect(HealthResponseSchema.safeParse({ status: 'running', extra: true }).success).toBe(false);
  });
});
