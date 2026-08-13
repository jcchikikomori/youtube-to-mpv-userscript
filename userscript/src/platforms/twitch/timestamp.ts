const PLAIN_SECONDS_RE = /^\d+$/;
const DURATION_RE = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i;

/**
 * Twitch VOD `?t=1h2m3s`-style timestamps. Same shape as YouTube's legacy duration form —
 * ported (not imported) per this module's README: platforms/youtube/** stays youtube-only, no
 * cross-platform sharing beyond contracts/. Live-channel URLs have no timestamp concept, so
 * TwitchSource never calls this for a channel resolveUrl().
 */
export function parseTwitchTimestamp(raw: string | null | undefined): number | null {
  if (!raw) return null;

  if (PLAIN_SECONDS_RE.test(raw)) {
    return parseInt(raw, 10);
  }

  const match = DURATION_RE.exec(raw);
  if (!match || !(match[1] || match[2] || match[3])) return null;

  const hours = parseInt(match[1] ?? '0', 10);
  const minutes = parseInt(match[2] ?? '0', 10);
  const seconds = parseInt(match[3] ?? '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}
