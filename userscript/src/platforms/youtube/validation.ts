// Unchanged from the original userscript's isValidVideoId regex.
export const YOUTUBE_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

const WATCH_HOSTNAMES = new Set(['www.youtube.com', 'youtube.com', 'm.youtube.com']);
const SHORT_LINK_HOSTNAME = 'youtu.be';
const SHORTS_PATH_RE = /^\/shorts\/([^/]+)$/;

export function isValidYoutubeVideoId(id: string): boolean {
  return YOUTUBE_VIDEO_ID_RE.test(id);
}

/**
 * The single source of truth both isValidYoutubeUrl and extractYoutubeVideoId derive from, so
 * the two can never disagree (the invariant every VideoSource's supports()/resolveUrl() must
 * satisfy). Rejects http:, userinfo-in-URL host-confusion tricks, and any hostname/path shape
 * a human wouldn't actually paste.
 */
function extractIdFromParsedUrl(parsed: URL): string | null {
  if (parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;

  if (WATCH_HOSTNAMES.has(parsed.hostname)) {
    if (parsed.pathname === '/watch') {
      const id = parsed.searchParams.get('v');
      if (id && isValidYoutubeVideoId(id)) return id;
      return null;
    }
    const shortsMatch = SHORTS_PATH_RE.exec(parsed.pathname);
    if (shortsMatch) {
      const id = shortsMatch[1];
      if (id && isValidYoutubeVideoId(id)) return id;
    }
    return null;
  }

  if (parsed.hostname === SHORT_LINK_HOSTNAME) {
    const id = parsed.pathname.slice(1);
    if (isValidYoutubeVideoId(id)) return id;
  }

  return null;
}

export function isValidYoutubeUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return extractIdFromParsedUrl(parsed) !== null;
}

/** Accepts either a bare 11-character id or a full YouTube URL (watch/shorts/youtu.be). */
export function extractYoutubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (isValidYoutubeVideoId(trimmed)) return trimmed;

  try {
    return extractIdFromParsedUrl(new URL(trimmed));
  } catch {
    return null;
  }
}

/** Always rebuilds the canonical watch URL from the id — never forwards a raw input string. */
export function buildYoutubeWatchUrl(videoId: string): string | null {
  if (!isValidYoutubeVideoId(videoId)) return null;
  return `https://www.youtube.com/watch?v=${videoId}`;
}
