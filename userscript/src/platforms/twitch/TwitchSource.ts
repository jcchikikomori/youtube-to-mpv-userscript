import { AbstractVideoSource } from '../../contracts/AbstractVideoSource.js';
import {
  buildTwitchChannelUrl,
  buildTwitchVodUrl,
  extractTwitchChannel,
  extractTwitchVodId,
} from './validation.js';
import { parseTwitchTimestamp } from './timestamp.js';

export class TwitchSource extends AbstractVideoSource {
  readonly platform = 'twitch' as const;

  supports(input: string): boolean {
    return extractTwitchVodId(input) !== null || extractTwitchChannel(input) !== null;
  }

  resolveUrl(input: string): string | null {
    // VOD id is checked first, but extractTwitchVodId only ever matches a full /videos/<id>
    // URL (see validation.ts) — a bare all-digit string falls through to the channel check
    // below and resolves as a channel name instead, since Twitch allows all-digit usernames.
    const vodId = extractTwitchVodId(input);
    if (vodId) return buildTwitchVodUrl(vodId);

    const channel = extractTwitchChannel(input);
    return channel ? buildTwitchChannelUrl(channel) : null;
  }

  parseTimestamp(raw: string): number | null {
    return parseTwitchTimestamp(raw);
  }
}
