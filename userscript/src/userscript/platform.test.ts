import { describe, expect, it } from 'vitest';
import { getPlatform } from './platform.js';

describe('getPlatform', () => {
  it.each([
    ['Linux x86_64', 'linux'],
    ['MacIntel', 'mac'],
    ['Win32', 'windows'],
    ['Win64', 'windows'],
    ['FreeBSD amd64', 'unknown'],
  ] as const)('maps navigator.platform %s to %s', (platformString, expected) => {
    expect(getPlatform(platformString)).toBe(expected);
  });
});
