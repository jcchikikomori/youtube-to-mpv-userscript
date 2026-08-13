import { describe, expect, it, vi } from 'vitest';
import type { MpvHandlerClient } from '../../baseline/MpvHandlerClient.js';
import { InvalidVideoInputError } from '../../contracts/errors.js';
import { TwitchSource } from './TwitchSource.js';

const CHANNEL = 'some_streamer';
const CHANNEL_URL = `https://www.twitch.tv/${CHANNEL}`;
const VOD_ID = '123456789';
const VOD_URL = `https://www.twitch.tv/videos/${VOD_ID}`;

function fakeClient(play = vi.fn().mockResolvedValue({ status: 'ok' })) {
  return { play } as unknown as MpvHandlerClient;
}

describe('TwitchSource', () => {
  it('reports platform as twitch', () => {
    expect(new TwitchSource(fakeClient()).platform).toBe('twitch');
  });

  it('supports a bare channel name and a channel URL', () => {
    const source = new TwitchSource(fakeClient());
    expect(source.supports(CHANNEL)).toBe(true);
    expect(source.supports(CHANNEL_URL)).toBe(true);
  });

  it('supports a VOD URL', () => {
    expect(new TwitchSource(fakeClient()).supports(VOD_URL)).toBe(true);
  });

  it('resolves a bare all-digit string as a channel name, not a VOD id (documented ambiguity — see validation.ts)', () => {
    const source = new TwitchSource(fakeClient());
    expect(source.supports(VOD_ID)).toBe(true);
    expect(source.resolveUrl(VOD_ID)).toBe(`https://www.twitch.tv/${VOD_ID}`);
  });

  it('does not support garbage input', () => {
    expect(new TwitchSource(fakeClient()).supports('not a channel')).toBe(false);
  });

  it('resolves a bare channel name and a channel URL to the same canonical URL', () => {
    const source = new TwitchSource(fakeClient());
    expect(source.resolveUrl(CHANNEL)).toBe(CHANNEL_URL);
    expect(source.resolveUrl(CHANNEL_URL)).toBe(CHANNEL_URL);
  });

  it('resolves a VOD URL to the canonical VOD URL', () => {
    const source = new TwitchSource(fakeClient());
    expect(source.resolveUrl(VOD_URL)).toBe(VOD_URL);
  });

  it('open() by channel name calls the client with the canonical URL', async () => {
    const play = vi.fn().mockResolvedValue({ status: 'ok' });
    const source = new TwitchSource(fakeClient(play));

    const result = await source.open(CHANNEL);

    expect(result).toEqual({ resolvedUrl: CHANNEL_URL, timestampSeconds: null });
    expect(play).toHaveBeenCalledWith(CHANNEL_URL, { timestampSeconds: null, cookies: null });
  });

  it('open() by VOD URL forwards a timestamp', async () => {
    const play = vi.fn().mockResolvedValue({ status: 'ok' });
    const source = new TwitchSource(fakeClient(play));

    const result = await source.open(VOD_URL, { timestampSeconds: 90 });

    expect(result).toEqual({ resolvedUrl: VOD_URL, timestampSeconds: 90 });
    expect(play).toHaveBeenCalledWith(VOD_URL, { timestampSeconds: 90, cookies: null });
  });

  it('open() forwards cookies for authenticated playback', async () => {
    const play = vi.fn().mockResolvedValue({ status: 'ok' });
    const source = new TwitchSource(fakeClient(play));
    const cookies = [{ domain: '.twitch.tv', name: 'auth-token', value: 'secret' }];

    await source.open(CHANNEL, { cookies });

    expect(play).toHaveBeenCalledWith(CHANNEL_URL, { timestampSeconds: null, cookies });
  });

  it('open() rejects invalid input without calling the client', async () => {
    const play = vi.fn();
    const source = new TwitchSource(fakeClient(play));

    await expect(source.open('not a channel')).rejects.toBeInstanceOf(InvalidVideoInputError);
    expect(play).not.toHaveBeenCalled();
  });

  it('parseTimestamp delegates to the twitch timestamp parser', () => {
    const source = new TwitchSource(fakeClient());
    expect(source.parseTimestamp('1m30s')).toBe(90);
    expect(source.parseTimestamp('garbage')).toBeNull();
  });
});
