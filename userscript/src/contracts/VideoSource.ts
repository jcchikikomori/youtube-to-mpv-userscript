import type { CookieEntry } from '../baseline/types.js';

export interface OpenOptions {
  timestampSeconds?: number | null;
  /** Cookies to forward for authenticated/subscriber-only playback. Never persisted. */
  cookies?: CookieEntry[] | null;
}

export interface OpenResult {
  resolvedUrl: string;
  timestampSeconds: number | null;
}

/**
 * Contract every platform module implements (YouTube today, Twitch later). A future platform
 * plugs in purely by implementing this interface (typically via AbstractVideoSource) — nothing
 * under baseline/ or this file needs to change.
 */
// Members are typed as function-valued properties (`foo: (x) => y`), not method signatures
// (`foo(x): y`), on purpose: method signatures carry an implicit `this` and trip
// @typescript-eslint/unbound-method wherever a VideoSource is destructured or its members
// referenced as values (registries, test fakes). A class's method declarations still satisfy
// a property-of-function-type interface member structurally, so AbstractVideoSource/YoutubeSource
// are unaffected.
export interface VideoSource {
  /** e.g. 'youtube', later 'twitch'. */
  readonly platform: string;
  /** Does this URL/ID belong to this platform? */
  readonly supports: (input: string) => boolean;
  /** Canonicalize a URL-or-ID into a playable URL, or null if invalid. Must agree with supports(). */
  readonly resolveUrl: (input: string) => string | null;
  readonly open: (input: string, options?: OpenOptions) => Promise<OpenResult>;
  /** Optional: parse a platform-specific raw timestamp string (e.g. "1h2m3s") into seconds. */
  readonly parseTimestamp?: (raw: string) => number | null;
}
