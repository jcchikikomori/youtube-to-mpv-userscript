import { describe, expect, it } from 'vitest';
import { assertLoopbackUrl } from './loopback.js';

describe('assertLoopbackUrl', () => {
  it.each([
    'http://127.0.0.1:38421',
    'http://localhost:38421',
    'http://[::1]:38421',
    'http://127.0.0.1',
  ])('accepts %s', (url) => {
    expect(() => assertLoopbackUrl(url)).not.toThrow();
  });

  it.each([
    ['https://127.0.0.1:38421', /http:/],
    ['http://evil.com:38421', /loopback/],
    ['http://127.0.0.1.evil.com:38421', /loopback/],
    ['http://user@127.0.0.1:38421', /credentials/],
    ['http://user:pass@127.0.0.1:38421', /credentials/],
  ])('rejects %s', (url, expectedMessage) => {
    expect(() => assertLoopbackUrl(url)).toThrow(expectedMessage);
  });
});
