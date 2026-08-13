import { describe, expect, it } from 'vitest';
import { sanitizeCookiesForWire } from './cookies.js';

const VALID_COOKIE = { domain: '.twitch.tv', name: 'auth-token', value: 'secretvalue' };

describe('sanitizeCookiesForWire', () => {
  it('returns null for null, undefined, and an empty array', () => {
    expect(sanitizeCookiesForWire(null)).toBeNull();
    expect(sanitizeCookiesForWire(undefined)).toBeNull();
    expect(sanitizeCookiesForWire([])).toBeNull();
  });

  it('passes through a minimal valid cookie unchanged', () => {
    expect(sanitizeCookiesForWire([VALID_COOKIE])).toEqual([VALID_COOKIE]);
  });

  it('passes through all recognized optional fields', () => {
    const cookie = {
      ...VALID_COOKIE,
      path: '/',
      secure: true,
      httpOnly: true,
      expirationDate: 1750000000,
    };
    expect(sanitizeCookiesForWire([cookie])).toEqual([cookie]);
  });

  it('defaults a missing value to an empty string', () => {
    const { value: _value, ...withoutValue } = VALID_COOKIE;
    expect(sanitizeCookiesForWire([withoutValue as never])).toEqual([
      { ...withoutValue, value: '' },
    ]);
  });

  it('strips unrecognized fields (data minimization)', () => {
    expect(() => sanitizeCookiesForWire([{ ...VALID_COOKIE, sameSite: 'lax' } as never])).toThrow(
      RangeError,
    );
  });

  it('rejects a non-array input', () => {
    expect(() => sanitizeCookiesForWire('not an array' as never)).toThrow(RangeError);
  });

  it('rejects more than 200 cookies', () => {
    const cookies = Array.from({ length: 201 }, () => VALID_COOKIE);
    expect(() => sanitizeCookiesForWire(cookies)).toThrow(RangeError);
  });

  it('accepts exactly 200 cookies', () => {
    const cookies = Array.from({ length: 200 }, () => VALID_COOKIE);
    expect(sanitizeCookiesForWire(cookies)).toHaveLength(200);
  });

  it('rejects a missing required field', () => {
    const { domain: _domain, ...withoutDomain } = VALID_COOKIE;
    expect(() => sanitizeCookiesForWire([withoutDomain as never])).toThrow(RangeError);
  });

  it('rejects an empty required field', () => {
    expect(() => sanitizeCookiesForWire([{ ...VALID_COOKIE, name: '' }])).toThrow(RangeError);
  });

  it('rejects a non-string field', () => {
    expect(() => sanitizeCookiesForWire([{ ...VALID_COOKIE, domain: 123 as never }])).toThrow(
      RangeError,
    );
  });

  it('rejects a field exceeding the max length', () => {
    expect(() => sanitizeCookiesForWire([{ ...VALID_COOKIE, value: 'x'.repeat(4097) }])).toThrow(
      RangeError,
    );
  });

  it.each(['\t', '\n'])('rejects a field containing a forbidden control character (%j)', (char) => {
    expect(() => sanitizeCookiesForWire([{ ...VALID_COOKIE, value: `bad${char}value` }])).toThrow(
      RangeError,
    );
  });

  it('rejects a non-boolean secure/httpOnly field', () => {
    expect(() => sanitizeCookiesForWire([{ ...VALID_COOKIE, secure: 'yes' as never }])).toThrow(
      RangeError,
    );
    expect(() => sanitizeCookiesForWire([{ ...VALID_COOKIE, httpOnly: 1 as never }])).toThrow(
      RangeError,
    );
  });

  it('rejects a non-numeric, non-null expirationDate', () => {
    expect(() =>
      sanitizeCookiesForWire([{ ...VALID_COOKIE, expirationDate: 'never' as never }]),
    ).toThrow(RangeError);
  });

  it('accepts a null expirationDate (session cookie)', () => {
    expect(sanitizeCookiesForWire([{ ...VALID_COOKIE, expirationDate: null }])).toEqual([
      { ...VALID_COOKIE, expirationDate: null },
    ]);
  });

  it('rejects a non-finite expirationDate', () => {
    expect(() => sanitizeCookiesForWire([{ ...VALID_COOKIE, expirationDate: Infinity }])).toThrow(
      RangeError,
    );
  });

  it('rejects a non-plain-object entry', () => {
    expect(() => sanitizeCookiesForWire(['not an object' as never])).toThrow(RangeError);
  });
});
