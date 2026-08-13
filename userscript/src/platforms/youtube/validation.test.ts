import { describe, expect, it } from 'vitest';
import {
  buildYoutubeWatchUrl,
  extractYoutubeVideoId,
  isValidYoutubeUrl,
  isValidYoutubeVideoId,
} from './validation.js';

const VALID_ID = 'dQw4w9WgXcQ';

describe('isValidYoutubeVideoId', () => {
  it('accepts a well-formed 11-character id', () => {
    expect(isValidYoutubeVideoId(VALID_ID)).toBe(true);
  });

  it.each(['tooshort', 'way-too-long-for-an-id', 'has spaces!', '', 'not-11-chars'])(
    'rejects %s',
    (id) => {
      expect(isValidYoutubeVideoId(id)).toBe(false);
    },
  );
});

describe('isValidYoutubeUrl', () => {
  it.each([
    `https://www.youtube.com/watch?v=${VALID_ID}`,
    `https://youtube.com/watch?v=${VALID_ID}`,
    `https://m.youtube.com/watch?v=${VALID_ID}`,
    `https://www.youtube.com/watch?v=${VALID_ID}&list=PL123&si=abc`,
    `https://www.youtube.com/shorts/${VALID_ID}`,
    `https://youtu.be/${VALID_ID}`,
    `https://youtu.be/${VALID_ID}?t=30`,
  ])('accepts %s', (url) => {
    expect(isValidYoutubeUrl(url)).toBe(true);
  });

  it.each([
    'not a url at all',
    'javascript:alert(1)',
    `http://www.youtube.com/watch?v=${VALID_ID}`,
    `https://youtube.com.evil.com/watch?v=${VALID_ID}`,
    `https://youtube.com@evil.com/watch?v=${VALID_ID}`,
    `https://evil.com/watch?v=${VALID_ID}`,
    `https://www.youtube.com/watch?v=short`,
    'https://www.youtube.com/',
    'https://youtu.be/',
  ])('rejects %s', (url) => {
    expect(isValidYoutubeUrl(url)).toBe(false);
  });
});

describe('extractYoutubeVideoId', () => {
  it('accepts a bare id', () => {
    expect(extractYoutubeVideoId(VALID_ID)).toBe(VALID_ID);
  });

  it('accepts a bare id with surrounding whitespace', () => {
    expect(extractYoutubeVideoId(`  ${VALID_ID}  `)).toBe(VALID_ID);
  });

  it('accepts a full watch URL', () => {
    expect(extractYoutubeVideoId(`https://www.youtube.com/watch?v=${VALID_ID}`)).toBe(VALID_ID);
  });

  it('accepts a shorts URL', () => {
    expect(extractYoutubeVideoId(`https://www.youtube.com/shorts/${VALID_ID}`)).toBe(VALID_ID);
  });

  it('accepts a youtu.be short link', () => {
    expect(extractYoutubeVideoId(`https://youtu.be/${VALID_ID}`)).toBe(VALID_ID);
  });

  it.each([
    'not-a-valid-input',
    `https://evil.com/watch?v=${VALID_ID}`,
    `https://youtube.com@evil.com/watch?v=${VALID_ID}`,
    `https://youtube.com.evil.com/watch?v=${VALID_ID}`,
  ])('rejects %s', (input) => {
    expect(extractYoutubeVideoId(input)).toBeNull();
  });

  it('never returns an id that fails isValidYoutubeVideoId (supports/resolveUrl agreement)', () => {
    const id = extractYoutubeVideoId(`https://www.youtube.com/watch?v=${VALID_ID}`);
    expect(id).not.toBeNull();
    expect(isValidYoutubeVideoId(id ?? '')).toBe(true);
  });
});

describe('buildYoutubeWatchUrl', () => {
  it('builds the canonical watch URL from a valid id', () => {
    expect(buildYoutubeWatchUrl(VALID_ID)).toBe(`https://www.youtube.com/watch?v=${VALID_ID}`);
  });

  it('returns null for an invalid id', () => {
    expect(buildYoutubeWatchUrl('short')).toBeNull();
  });
});
