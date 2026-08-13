import { describe, expect, it } from 'vitest';
import {
  buildTwitchChannelUrl,
  buildTwitchVodUrl,
  extractTwitchChannel,
  extractTwitchVodId,
  isValidTwitchChannel,
  isValidTwitchVodId,
} from './validation.js';

describe('isValidTwitchChannel', () => {
  it.each(['some_streamer', 'abcd', 'a'.repeat(25), 'user123', '1234'])(
    'accepts valid channel name "%s"',
    (name) => {
      expect(isValidTwitchChannel(name)).toBe(true);
    },
  );

  it.each(['abc', 'a'.repeat(26), 'bad-name', 'has space', ''])(
    'rejects malformed channel name "%s"',
    (name) => {
      expect(isValidTwitchChannel(name)).toBe(false);
    },
  );

  it.each(['videos', 'settings', 'directory', 'login', 'SETTINGS'])(
    'rejects reserved path "%s" even though it matches the name shape',
    (name) => {
      expect(isValidTwitchChannel(name)).toBe(false);
    },
  );
});

describe('isValidTwitchVodId', () => {
  it('accepts a numeric id', () => {
    expect(isValidTwitchVodId('123456789')).toBe(true);
  });

  it.each(['abc', '12a', '', '1.5', '-5'])('rejects non-numeric id "%s"', (id) => {
    expect(isValidTwitchVodId(id)).toBe(false);
  });
});

describe('extractTwitchChannel', () => {
  it.each([
    ['https://www.twitch.tv/some_streamer', 'some_streamer'],
    ['https://twitch.tv/some_streamer', 'some_streamer'],
    ['https://m.twitch.tv/some_streamer', 'some_streamer'],
    ['some_streamer', 'some_streamer'],
  ])('extracts channel from "%s"', (input, expected) => {
    expect(extractTwitchChannel(input)).toBe(expected);
  });

  it('rejects a reserved-path URL', () => {
    expect(extractTwitchChannel('https://www.twitch.tv/settings')).toBeNull();
  });

  it('rejects a VOD URL', () => {
    expect(extractTwitchChannel('https://www.twitch.tv/videos/123456789')).toBeNull();
  });

  it('rejects http:// downgrade', () => {
    expect(extractTwitchChannel('http://www.twitch.tv/some_streamer')).toBeNull();
  });

  it('rejects userinfo-in-URL host-confusion tricks', () => {
    expect(extractTwitchChannel('https://some_streamer@www.twitch.tv/other')).toBeNull();
  });

  it('rejects an unrelated hostname', () => {
    expect(extractTwitchChannel('https://evil.com/some_streamer')).toBeNull();
  });

  it('rejects garbage input', () => {
    expect(extractTwitchChannel('not a channel')).toBeNull();
  });
});

describe('extractTwitchVodId', () => {
  it('extracts a VOD id from a full URL', () => {
    expect(extractTwitchVodId('https://www.twitch.tv/videos/123456789')).toBe('123456789');
  });

  it('rejects a non-numeric VOD id in the URL', () => {
    expect(extractTwitchVodId('https://www.twitch.tv/videos/abc')).toBeNull();
  });

  it('rejects a bare numeric string (ambiguous with an all-digit channel name)', () => {
    expect(extractTwitchVodId('123456789')).toBeNull();
  });

  it('rejects a channel URL', () => {
    expect(extractTwitchVodId('https://www.twitch.tv/some_streamer')).toBeNull();
  });

  it('rejects http:// downgrade', () => {
    expect(extractTwitchVodId('http://www.twitch.tv/videos/123456789')).toBeNull();
  });

  it('rejects userinfo-in-URL host-confusion tricks', () => {
    expect(extractTwitchVodId('https://123456789@www.twitch.tv/videos/123456789')).toBeNull();
  });
});

describe('buildTwitchChannelUrl', () => {
  it('rebuilds the canonical URL from a valid channel', () => {
    expect(buildTwitchChannelUrl('some_streamer')).toBe('https://www.twitch.tv/some_streamer');
  });

  it('returns null for an invalid channel', () => {
    expect(buildTwitchChannelUrl('bad-name')).toBeNull();
  });

  it('returns null for a reserved path', () => {
    expect(buildTwitchChannelUrl('settings')).toBeNull();
  });
});

describe('buildTwitchVodUrl', () => {
  it('rebuilds the canonical URL from a valid VOD id', () => {
    expect(buildTwitchVodUrl('123456789')).toBe('https://www.twitch.tv/videos/123456789');
  });

  it('returns null for a non-numeric id', () => {
    expect(buildTwitchVodUrl('abc')).toBeNull();
  });
});
