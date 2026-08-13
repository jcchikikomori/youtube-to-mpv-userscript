import { describe, expect, it } from 'vitest';
import { parseTwitchTimestamp } from './timestamp.js';

describe('parseTwitchTimestamp', () => {
  it.each([null, undefined, '', 'garbage', 'hms'])('returns null for %s', (raw) => {
    expect(parseTwitchTimestamp(raw)).toBeNull();
  });

  it('parses plain integer seconds', () => {
    expect(parseTwitchTimestamp('699')).toBe(699);
  });

  it('parses "0" as 0, not null', () => {
    expect(parseTwitchTimestamp('0')).toBe(0);
  });

  it.each([
    ['90s', 90],
    ['1m30s', 90],
    ['1h2m3s', 3723],
    ['1h', 3600],
    ['2m', 120],
  ])('parses legacy duration form %s as %d seconds', (raw, expected) => {
    expect(parseTwitchTimestamp(raw)).toBe(expected);
  });
});
