import { describe, expect, it, vi } from 'vitest';
import type { MpvHandlerClient } from '../../baseline/MpvHandlerClient.js';
import { InvalidVideoInputError } from '../../contracts/errors.js';
import { YoutubeSource } from './YoutubeSource.js';

const VALID_ID = 'dQw4w9WgXcQ';
const WATCH_URL = `https://www.youtube.com/watch?v=${VALID_ID}`;

function fakeClient(play = vi.fn().mockResolvedValue({ status: 'ok' })) {
  return { play } as unknown as MpvHandlerClient;
}

describe('YoutubeSource', () => {
  it('reports platform as youtube', () => {
    expect(new YoutubeSource(fakeClient()).platform).toBe('youtube');
  });

  it('supports both a bare id and a full URL', () => {
    const source = new YoutubeSource(fakeClient());
    expect(source.supports(VALID_ID)).toBe(true);
    expect(source.supports(WATCH_URL)).toBe(true);
    expect(source.supports('not a video')).toBe(false);
  });

  it('resolves a bare id and a full URL to the same canonical URL', () => {
    const source = new YoutubeSource(fakeClient());
    expect(source.resolveUrl(VALID_ID)).toBe(WATCH_URL);
    expect(source.resolveUrl(WATCH_URL)).toBe(WATCH_URL);
  });

  it('open() by bare id calls the client with the canonical URL', async () => {
    const play = vi.fn().mockResolvedValue({ status: 'ok' });
    const source = new YoutubeSource(fakeClient(play));

    const result = await source.open(VALID_ID, { timestampSeconds: 90 });

    expect(result).toEqual({ resolvedUrl: WATCH_URL, timestampSeconds: 90 });
    expect(play).toHaveBeenCalledWith(WATCH_URL, { timestampSeconds: 90, cookies: null });
  });

  it('open() by full URL goes through the identical path as by id', async () => {
    const play = vi.fn().mockResolvedValue({ status: 'ok' });
    const source = new YoutubeSource(fakeClient(play));

    const result = await source.open(WATCH_URL);

    expect(result).toEqual({ resolvedUrl: WATCH_URL, timestampSeconds: null });
    expect(play).toHaveBeenCalledWith(WATCH_URL, { timestampSeconds: null, cookies: null });
  });

  it('open() rejects invalid input without calling the client', async () => {
    const play = vi.fn();
    const source = new YoutubeSource(fakeClient(play));

    await expect(source.open('not a video')).rejects.toBeInstanceOf(InvalidVideoInputError);
    expect(play).not.toHaveBeenCalled();
  });

  it('parseTimestamp delegates to the youtube timestamp parser', () => {
    const source = new YoutubeSource(fakeClient());
    expect(source.parseTimestamp('1m30s')).toBe(90);
    expect(source.parseTimestamp('garbage')).toBeNull();
  });
});
