import { afterEach, describe, expect, it, vi } from 'vitest';
import { getYoutubeCookies } from './youtubeCookies.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getYoutubeCookies', () => {
  it('resolves null when GM_cookie is unavailable (Greasemonkey/older Violentmonkey)', async () => {
    await expect(getYoutubeCookies()).resolves.toBeNull();
  });

  it('scopes the GM_cookie.list call to the youtube.com domain only', async () => {
    const list = vi.fn(
      (
        _details: GMCookieListDetails,
        callback: (cookies: GMCookie[], error: string | null) => void,
      ) => {
        callback([], null);
      },
    );
    vi.stubGlobal('GM_cookie', { list });

    await getYoutubeCookies();

    expect(list).toHaveBeenCalledWith({ domain: 'youtube.com' }, expect.anything());
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

    await expect(getYoutubeCookies()).resolves.toBeNull();
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

    await expect(getYoutubeCookies()).resolves.toBeNull();
  });

  it('maps a persistent cookie to a CookieEntry', async () => {
    const rawCookie: GMCookie = {
      domain: '.youtube.com',
      name: 'SID',
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

    await expect(getYoutubeCookies()).resolves.toEqual([
      {
        domain: '.youtube.com',
        name: 'SID',
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
        _details: GMCookieListDetails,
        callback: (cookies: GMCookie[], error: string | null) => void,
      ) => {
        callback([rawCookie], null);
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
