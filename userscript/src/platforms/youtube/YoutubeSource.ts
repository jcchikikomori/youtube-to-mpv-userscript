import { AbstractVideoSource } from '../../contracts/AbstractVideoSource.js';
import { buildYoutubeWatchUrl, extractYoutubeVideoId } from './validation.js';
import { parseYoutubeTimestamp } from './timestamp.js';

export class YoutubeSource extends AbstractVideoSource {
  readonly platform = 'youtube' as const;

  supports(input: string): boolean {
    return extractYoutubeVideoId(input) !== null;
  }

  resolveUrl(input: string): string | null {
    const id = extractYoutubeVideoId(input);
    return id ? buildYoutubeWatchUrl(id) : null;
  }

  parseTimestamp(raw: string): number | null {
    return parseYoutubeTimestamp(raw);
  }
}
