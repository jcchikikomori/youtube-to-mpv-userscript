import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTwitchCookies } from './twitchCookies.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getTwitchCookies', () => {
  it('resolves null when GM_cookie is unavailable (Greasemonkey/older Violentmonkey)', async () => {
    await expect(getTwitchCookies()).resolves.toBeNull();
  });

  it('scopes the GM_cookie.list call to the twitch.tv domain only', async () => {
    const list = vi.fn(
      (
        _details: GMCookieListDetails,
        callback: (cookies: GMCookie[], error: string | null) => void,
      ) => {
        callback([], null);
      },
    );
    vi.stubGlobal('GM_cookie', { list });

    await getTwitchCookies();

    expect(list).toHaveBeenCalledWith({ domain: 'twitch.tv' }, expect.anything());
  });

  it('resolves null when GM_cookie reports an error', async () => {
    vi.stubGlobal('GM_cookie', {
      list: (
        _details: GMCookieListDetails,
        callback: (cookies: GMCookie[], error: string | null) => void,
      ) => {
        callback([], 'boom');
      },
    });

    await expect(getTwitchCookies()).resolves.toBeNull();
  });

  it('resolves null when no cookies are found', async () => {
    vi.stubGlobal('GM_cookie', {
      list: (
        _details: GMCookieListDetails,
        callback: (cookies: GMCookie[], error: string | null) => void,
      ) => {
        callback([], null);
      },
    });

    await expect(getTwitchCookies()).resolves.toBeNull();
  });

  it('maps a persistent cookie to a CookieEntry', async () => {
    const rawCookie: GMCookie = {
      domain: '.twitch.tv',
      name: 'auth-token',
      value: 'secret',
      path: '/',
      secure: true,
      httpOnly: true,
      session: false,
      expirationDate: 1750000000,
    };
    vi.stubGlobal('GM_cookie', {
      list: (
        _details: GMCookieListDetails,
        callback: (cookies: GMCookie[], error: string | null) => void,
      ) => {
        callback([rawCookie], null);
      },
    });

    await expect(getTwitchCookies()).resolves.toEqual([
      {
        domain: '.twitch.tv',
        name: 'auth-token',
        value: 'secret',
        path: '/',
        secure: true,
        httpOnly: true,
        expirationDate: 1750000000,
      },
    ]);
  });

  it('maps a session cookie to a null expirationDate even if the browser reports a stale value', async () => {
    const rawCookie: GMCookie = {
      domain: '.twitch.tv',
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
        _details: GMCookieListDetails,
        callback: (cookies: GMCookie[], error: string | null) => void,
      ) => {
        callback([rawCookie], null);
      },
    });

    const result = await getTwitchCookies();
    expect(result?.[0]?.expirationDate).toBeNull();
  });

  it('resolves null when GM_cookie.list throws synchronously', async () => {
    vi.stubGlobal('GM_cookie', {
      list: () => {
        throw new Error('boom');
      },
    });

    await expect(getTwitchCookies()).resolves.toBeNull();
  });
});
