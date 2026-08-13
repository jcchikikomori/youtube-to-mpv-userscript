import { describe, expect, it } from 'vitest';
import type { OpenOptions, OpenResult, VideoSource } from './contracts/VideoSource.js';
import { VideoSourceRegistry } from './registry.js';

function fakeSource(platform: string, supportedInput: string): VideoSource {
  return {
    platform,
    supports: (input: string): boolean => input === supportedInput,
    resolveUrl: (input: string): string | null =>
      input === supportedInput ? `resolved:${input}` : null,
    open: async (input: string, _options?: OpenOptions): Promise<OpenResult> => ({
      resolvedUrl: `resolved:${input}`,
      timestampSeconds: null,
    }),
  };
}

describe('VideoSourceRegistry', () => {
  const youtube = fakeSource('youtube', 'yt-input');
  const twitch = fakeSource('twitch', 'tw-input');
  const registry = new VideoSourceRegistry([youtube, twitch]);

  it('find() returns the first source whose supports() matches', () => {
    expect(registry.find('yt-input')).toBe(youtube);
    expect(registry.find('tw-input')).toBe(twitch);
  });

  it('find() returns null when no source matches', () => {
    expect(registry.find('nothing-matches')).toBeNull();
  });

  it('get() looks up by exact platform name', () => {
    expect(registry.get('youtube')).toBe(youtube);
    expect(registry.get('twitch')).toBe(twitch);
    expect(registry.get('unknown')).toBeNull();
  });

  it('list() returns all registered sources in order', () => {
    expect(registry.list()).toEqual([youtube, twitch]);
  });
});
