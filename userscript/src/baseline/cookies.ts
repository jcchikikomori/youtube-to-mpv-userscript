import type { CookieEntry } from './types.js';

const MAX_COOKIES = 200;
const MAX_FIELD_LENGTH = 4096;
// Cookie-file line injection guard: a tab or newline in any field would corrupt the
// tab-separated Netscape file mpv-handler.py builds from this payload. Real browser cookies
// can't contain these per RFC 6265, but this is checked here too (fail fast, before any
// request is sent) rather than trusting that invariant to hold all the way from the browser.
const FORBIDDEN_CHARS_RE = /[\t\n]/;

const RECOGNIZED_KEYS = [
  'domain',
  'name',
  'value',
  'path',
  'secure',
  'httpOnly',
  'expirationDate',
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeStringField(
  value: unknown,
  fieldName: string,
  required: boolean,
): string | undefined {
  if (value === undefined) {
    if (required) throw new RangeError(`cookie ${fieldName} is required`);
    return undefined;
  }
  if (typeof value !== 'string') throw new RangeError(`cookie ${fieldName} must be a string`);
  if (value.length > MAX_FIELD_LENGTH)
    throw new RangeError(`cookie ${fieldName} exceeds ${MAX_FIELD_LENGTH} characters`);
  if (FORBIDDEN_CHARS_RE.test(value))
    throw new RangeError(`cookie ${fieldName} contains a forbidden control character`);
  if (required && value.length === 0) throw new RangeError(`cookie ${fieldName} must not be empty`);
  return value;
}

function sanitizeCookieEntry(entry: unknown): CookieEntry {
  if (!isPlainObject(entry)) throw new RangeError('cookie entry must be an object');

  const unexpectedKey = Object.keys(entry).find(
    (key) => !RECOGNIZED_KEYS.includes(key as (typeof RECOGNIZED_KEYS)[number]),
  );
  if (unexpectedKey) throw new RangeError(`unexpected cookie field "${unexpectedKey}"`);

  const domain = sanitizeStringField(entry.domain, 'domain', true) as string;
  const name = sanitizeStringField(entry.name, 'name', true) as string;
  const value = sanitizeStringField(entry.value, 'value', false) ?? '';
  const path = sanitizeStringField(entry.path, 'path', false);

  if (entry.secure !== undefined && typeof entry.secure !== 'boolean') {
    throw new RangeError('cookie secure must be a boolean');
  }
  if (entry.httpOnly !== undefined && typeof entry.httpOnly !== 'boolean') {
    throw new RangeError('cookie httpOnly must be a boolean');
  }
  if (
    entry.expirationDate !== undefined &&
    entry.expirationDate !== null &&
    !(typeof entry.expirationDate === 'number' && Number.isFinite(entry.expirationDate))
  ) {
    throw new RangeError('cookie expirationDate must be a finite number or null');
  }

  return {
    domain,
    name,
    value,
    ...(path !== undefined ? { path } : {}),
    ...(entry.secure !== undefined ? { secure: entry.secure } : {}),
    ...(entry.httpOnly !== undefined ? { httpOnly: entry.httpOnly } : {}),
    ...(entry.expirationDate !== undefined ? { expirationDate: entry.expirationDate } : {}),
  };
}

/**
 * Validates and strips a cookie payload down to only the recognized wire fields before it's
 * ever sent — data minimization (never forwards fields like `session`/`sameSite`/`storeId`
 * that GM_cookie.list() may include) plus a fail-fast size/shape check so a malformed or
 * oversized payload never reaches fetch/GM_xmlhttpRequest. Returns null for empty/absent input.
 */
export function sanitizeCookiesForWire(
  cookies: CookieEntry[] | null | undefined,
): CookieEntry[] | null {
  if (cookies === null || cookies === undefined) return null;
  if (!Array.isArray(cookies)) throw new RangeError('cookies must be an array');
  if (cookies.length === 0) return null;
  if (cookies.length > MAX_COOKIES)
    throw new RangeError(`cookies exceeds the maximum of ${MAX_COOKIES} entries`);

  return cookies.map(sanitizeCookieEntry);
}
