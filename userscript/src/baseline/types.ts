/**
 * The only surface of a fetch Response that MpvHandlerClient actually reads. Deliberately
 * narrower than DOM's full Response type so any transport — Node's global fetch, a
 * GM_xmlhttpRequest-backed adapter in the browser bundle, or a test mock — can satisfy it
 * without casts.
 */
export interface FetchResponseLike {
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
}

/** Minimal fetch-shaped transport function. See FetchResponseLike for why it's this narrow. */
export type FetchLike = (
  url: string,
  init?: {
    signal?: AbortSignal;
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<FetchResponseLike>;

/**
 * One browser cookie, shaped to match Tampermonkey's GM_cookie.list() return value verbatim —
 * the userscript-twitch bundle (not yet built) forwards that call's result straight through
 * with no reformatting. Deliberately narrower than GM_cookie's full shape: fields like
 * `session`/`sameSite`/`storeId` are never forwarded (data minimization — see
 * sanitizeCookiesForWire in cookies.ts).
 */
export interface CookieEntry {
  domain: string;
  name: string;
  value: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  expirationDate?: number | null;
}

export interface MpvHandlerClientOptions {
  /** Base URL of the mpv-handler.py server. Must be loopback unless allowNonLoopback is set. Default: 'http://127.0.0.1:38421'. */
  baseUrl?: string;
  /** Abort a request after this many milliseconds. Default: 5000. */
  timeoutMs?: number;
  /** Injectable fetch implementation, for tests or non-fetch transports. Defaults to the global fetch. */
  fetchImpl?: FetchLike;
  /**
   * Explicit opt-out of the loopback-only guard on baseUrl. Logs a warning every time the
   * client is constructed with this set — see baseline/loopback.ts.
   */
  allowNonLoopback?: boolean;
}

export interface PlayOptions {
  /** Second to start playback at. Must be finite and >= 0. Omit/null to start from the beginning. */
  timestampSeconds?: number | null;
  /** Cookies to forward for authenticated playback. Sent once per request, never persisted. */
  cookies?: CookieEntry[] | null;
}

export type ValidationResult<T> = { success: true; data: T } | { success: false; error: { message: string } };

/**
 * Just enough of zod's ZodType surface for MpvHandlerClient's needs. Hand-rolled instead of a
 * zod dependency: this package's only zod consumer was these two tiny response shapes, and
 * pulling in zod purely to validate them bloated the bundled userscript by 300+KB — a bad trade
 * for something a userscript re-parses on every YouTube page load. See baseline/schemas.ts.
 */
export interface Validator<T> {
  safeParse(value: unknown): ValidationResult<T>;
}
