import { afterEach, describe, expect, it, vi } from 'vitest';
import { getYoutubeCookies } from './youtubeCookies.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubEmptyGmCookie(): ReturnType<typeof vi.fn> {
  const list = vi.fn(
    (
      _details: GMCookieListDetails,
      callback: (cookies: GMCookie[], error: string | null) => void,
    ) => {
      callback([], null);
    },
  );
  vi.stubGlobal('GM_cookie', { list });
  return list;
}

describe('getYoutubeCookies', () => {
  it('resolves null when GM_cookie is unavailable (Greasemonkey/older Violentmonkey)', async () => {
    await expect(getYoutubeCookies()).resolves.toBeNull();
  });

  it('reads both the youtube.com and google.com domains', async () => {
    const list = stubEmptyGmCookie();

    await getYoutubeCookies();

    const calledDomains = list.mock.calls.map((call) => (call[0] as GMCookieListDetails).domain);
    expect(calledDomains.sort()).toEqual(['google.com', 'youtube.com']);
  });

  it('resolves null when both domains error', async () => {
    vi.stubGlobal('GM_cookie', {
      list: (
        _details: GMCookieListDetails,
        callback: (cookies: GMCookie[], error: string | null) => void,
      ) => {
        callback([], 'boom');
      },
    });

    await expect(getYoutubeCookies()).resolves.toBeNull();
  });

  it('resolves null when no cookies are found on either domain', async () => {
    stubEmptyGmCookie();

    await expect(getYoutubeCookies()).resolves.toBeNull();
  });

  it('merges cookies found on youtube.com and google.com into one export', async () => {
    const youtubeCookie: GMCookie = {
      domain: '.youtube.com',
      name: 'PREF',
      value: 'yt-pref',
      path: '/',
      secure: true,
      httpOnly: false,
      session: false,
      expirationDate: 1750000000,
    };
    const googleCookie: GMCookie = {
      domain: '.google.com',
      name: 'SAPISID',
      value: 'secret',
      path: '/',
      secure: true,
      httpOnly: false,
      session: false,
      expirationDate: 1750000001,
    };
    vi.stubGlobal('GM_cookie', {
      list: (
        details: GMCookieListDetails,
        callback: (cookies: GMCookie[], error: string | null) => void,
      ) => {
        callback(details.domain === 'google.com' ? [googleCookie] : [youtubeCookie], null);
      },
    });

    const result = await getYoutubeCookies();
    expect(result).toHaveLength(2);
    expect(result?.map((c) => c.name).sort()).toEqual(['PREF', 'SAPISID']);
  });

  it('still merges the other domain’s cookies when one domain errors', async () => {
    const googleCookie: GMCookie = {
      domain: '.google.com',
      name: 'SAPISID',
      value: 'secret',
      path: '/',
      secure: true,
      httpOnly: false,
      session: false,
      expirationDate: 1750000001,
    };
    vi.stubGlobal('GM_cookie', {
      list: (
        details: GMCookieListDetails,
        callback: (cookies: GMCookie[], error: string | null) => void,
      ) => {
        if (details.domain === 'google.com') {
          callback([googleCookie], null);
        } else {
          callback([], 'boom');
        }
      },
    });

    const result = await getYoutubeCookies();
    expect(result?.map((c) => c.name)).toEqual(['SAPISID']);
  });

  it('maps a session cookie to a null expirationDate even if the browser reports a stale value', async () => {
    const rawCookie: GMCookie = {
      domain: '.youtube.com',
      name: 'session-only',
      value: 'x',
      path: '/',
      secure: false,
      httpOnly: false,
      session: true,
      expirationDate: 12345,
    };
    vi.stubGlobal('GM_cookie', {
      list: (
        details: GMCookieListDetails,
        callback: (cookies: GMCookie[], error: string | null) => void,
      ) => {
        callback(details.domain === 'youtube.com' ? [rawCookie] : [], null);
      },
    });

    const result = await getYoutubeCookies();
    expect(result?.[0]?.expirationDate).toBeNull();
  });

  it('resolves null when GM_cookie.list throws synchronously', async () => {
    vi.stubGlobal('GM_cookie', {
      list: () => {
        throw new Error('boom');
      },
    });

    await expect(getYoutubeCookies()).resolves.toBeNull();
  });
});
