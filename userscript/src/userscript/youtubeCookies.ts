import type { CookieEntry } from '../baseline/types.js';

/**
 * Hardcoded, not a parameter — deliberately. This is the one place cookies get read for the
 * YouTube path, and keeping the domain list fixed here (instead of letting a caller pass one
 * in) is what guarantees this call can never drift into reading twitch.tv cookies too, and vice
 * versa for twitchCookies.ts. If you're adding cookie support for another platform, write that
 * platform its own equivalent of this file — don't parametrize this one.
 *
 * Two domains, both still exclusively "the YouTube platform's own auth": YouTube's actual
 * session/identity cookies (SID, SAPISID, LOGIN_INFO, etc.) are set on the .google.com apex
 * domain, not .youtube.com — a youtube.com-only export misses them, and a member-only video
 * fails exactly as if no cookies had been sent at all (yt-dlp gets a cookie file, but not the
 * one that actually authenticates). YouTube does mirror some of its own session state onto
 * .youtube.com too, so both are read and merged into one export.
 */
const YOUTUBE_COOKIE_DOMAINS = ['youtube.com', 'google.com'];

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

/** Resolves to [] (never rejects) on any per-domain failure — merged by the caller below. */
function listCookiesForDomain(domain: string): Promise<GMCookie[]> {
  return new Promise((resolve) => {
    try {
      GM_cookie.list({ domain }, (cookies, error) => {
        resolve(error || !cookies ? [] : cookies);
      });
    } catch {
      resolve([]);
    }
  });
}

/**
 * Reads youtube.com + google.com cookies via GM_cookie (Tampermonkey-specific — see
 * gm-globals.d.ts) and merges them into one export. Resolves to null (never rejects) on any
 * failure: GM_cookie unavailable (Greasemonkey/older Violentmonkey), both domains erroring, or
 * no cookies found on either — all treated identically as "proceed with anonymous playback,"
 * matching twitchCookies.ts's own graceful-degradation convention.
 */
export async function getYoutubeCookies(): Promise<CookieEntry[] | null> {
  if (typeof GM_cookie === 'undefined') {
    return null;
  }
  const perDomain = await Promise.all(YOUTUBE_COOKIE_DOMAINS.map(listCookiesForDomain));
  const merged = perDomain.flat();
  return merged.length === 0 ? null : merged.map(toCookieEntry);
}
