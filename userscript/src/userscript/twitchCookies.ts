import type { CookieEntry } from '../baseline/types.js';

/**
 * Hardcoded, not a parameter — deliberately. This is the one place cookies get read for the
 * Twitch path, and keeping the domain filter fixed here (instead of letting a caller pass one
 * in) is what guarantees a future YouTube cookie feature can never share this call and blur the
 * two platforms' cookie sets together. If you're adding cookie support for another platform,
 * write that platform its own equivalent of this file — don't parametrize this one.
 */
const TWITCH_COOKIE_DOMAIN = 'twitch.tv';

function toCookieEntry(cookie: GMCookie): CookieEntry {
  return {
    domain: cookie.domain,
    name: cookie.name,
    value: cookie.value,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    expirationDate: cookie.session ? null : (cookie.expirationDate ?? null),
  };
}

/**
 * Reads twitch.tv cookies via GM_cookie (Tampermonkey-specific — see gm-globals.d.ts). Resolves
 * to null (never rejects) on any failure: GM_cookie unavailable (Greasemonkey/older
 * Violentmonkey), a reported error, or no cookies found — all treated identically as "proceed
 * with anonymous playback," matching this project's existing graceful-degradation convention.
 */
export function getTwitchCookies(): Promise<CookieEntry[] | null> {
  return new Promise((resolve) => {
    if (typeof GM_cookie === 'undefined') {
      resolve(null);
      return;
    }
    try {
      GM_cookie.list({ domain: TWITCH_COOKIE_DOMAIN }, (cookies, error) => {
        if (error || !cookies || cookies.length === 0) {
          resolve(null);
          return;
        }
        resolve(cookies.map(toCookieEntry));
      });
    } catch {
      resolve(null);
    }
  });
}
