const PLAIN_SECONDS_RE = /^\d+$/;
const DURATION_RE = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i;

/**
 * Plain integer seconds ("699") or the legacy duration form ("1h2m3s"/"90s"/"1m30s"). Ported
 * 1:1 from the userscript's parseTimestampParam. Returns null (not 0) when absent/unparseable.
 * Decimal-second precision is still available end-to-end for programmatic callers via
 * OpenOptions.timestampSeconds (typed number), matching the Python handler's ^\d+(\.\d+)?$.
 */
export function parseYoutubeTimestamp(raw: string | null | undefined): number | null {
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
