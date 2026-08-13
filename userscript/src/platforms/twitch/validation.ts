const CHANNEL_HOSTNAMES = new Set(['www.twitch.tv', 'twitch.tv', 'm.twitch.tv']);
const CHANNEL_NAME_RE = /^[a-zA-Z0-9_]{4,25}$/;
const VOD_PATH_RE = /^\/videos\/(\d+)$/;

// Twitch reserves these top-level paths for site features, so `twitch.tv/<path>` for any of
// these is never a channel even though it matches CHANNEL_NAME_RE's shape.
const RESERVED_PATHS = new Set([
  'videos',
  'directory',
  'settings',
  'subscriptions',
  'p',
  'jobs',
  'turbo',
  'login',
  'signup',
  'moderator',
  'friends',
  'inventory',
  'wallet',
  'drops',
  'payments',
  'following',
  'search',
]);

export function isValidTwitchChannel(name: string): boolean {
  return CHANNEL_NAME_RE.test(name) && !RESERVED_PATHS.has(name.toLowerCase());
}

export function isValidTwitchVodId(id: string): boolean {
  return /^\d+$/.test(id);
}

/**
 * The single source of truth both supports() and resolveUrl() derive from (via
 * extractTwitchChannel/extractTwitchVodId below), so the two can never disagree — same
 * invariant as youtube/validation.ts's extractIdFromParsedUrl. Rejects http:, userinfo-in-URL
 * host-confusion tricks, and any hostname/path shape a human wouldn't actually paste.
 */
function parseTwitchPath(
  parsed: URL,
): { kind: 'channel'; value: string } | { kind: 'vod'; value: string } | null {
  if (parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;
  if (!CHANNEL_HOSTNAMES.has(parsed.hostname)) return null;

  const vodMatch = VOD_PATH_RE.exec(parsed.pathname);
  if (vodMatch) {
    const id = vodMatch[1];
    if (id && isValidTwitchVodId(id)) return { kind: 'vod', value: id };
    return null;
  }

  const channelMatch = /^\/([^/]+)$/.exec(parsed.pathname);
  if (channelMatch) {
    const name = channelMatch[1];
    if (name && isValidTwitchChannel(name)) return { kind: 'channel', value: name };
  }

  return null;
}

export function extractTwitchChannel(input: string): string | null {
  const trimmed = input.trim();
  if (isValidTwitchChannel(trimmed)) return trimmed;

  try {
    const result = parseTwitchPath(new URL(trimmed));
    return result?.kind === 'channel' ? result.value : null;
  } catch {
    return null;
  }
}

/**
 * Unlike extractTwitchChannel, this never accepts a bare numeric string — a channel name may
 * itself be all-digits (Twitch allows it), so a bare "12345" would be ambiguous between "VOD id
 * 12345" and "channel named 12345". Only the unambiguous `/videos/<id>` URL form is accepted.
 */
export function extractTwitchVodId(input: string): string | null {
  try {
    const result = parseTwitchPath(new URL(input.trim()));
    return result?.kind === 'vod' ? result.value : null;
  } catch {
    return null;
  }
}

/** Always rebuilds the canonical channel URL from the id — never forwards a raw input string. */
export function buildTwitchChannelUrl(channel: string): string | null {
  if (!isValidTwitchChannel(channel)) return null;
  return `https://www.twitch.tv/${channel}`;
}

/** Always rebuilds the canonical VOD URL from the id — never forwards a raw input string. */
export function buildTwitchVodUrl(vodId: string): string | null {
  if (!isValidTwitchVodId(vodId)) return null;
  return `https://www.twitch.tv/videos/${vodId}`;
}
