import { MpvHandlerClient } from '../baseline/MpvHandlerClient.js';
import { MpvHandlerError } from '../baseline/errors.js';
import type { CookieEntry } from '../baseline/types.js';
import { InvalidVideoInputError } from '../contracts/errors.js';
import type { VideoSource } from '../contracts/VideoSource.js';
import { TwitchSource } from '../platforms/twitch/TwitchSource.js';
import { YoutubeSource } from '../platforms/youtube/YoutubeSource.js';
import { buildMpvShellCommand, copyToClipboard } from './clipboardFallback.js';
import { getConfig } from './config.js';
import { initUserscriptUi } from './dom.js';
import { initTwitchUserscriptUi } from './domTwitch.js';
import { gmFetch } from './gmFetch.js';
import { getPlatform } from './platform.js';
import { showToast } from './toast.js';

const client = new MpvHandlerClient({ fetchImpl: gmFetch });

/**
 * Shared by both platform wirings below — dom.ts/domTwitch.ts each own the "couldn't extract a
 * video URL at all" case themselves (their own error toast, never call this). Every failure path
 * here is a network/handler problem instead, so they all fall back to the clipboard the same way
 * the original hand-written script did for any non-200 response.
 */
async function openInMpv(
  source: VideoSource,
  input: string,
  timestampSeconds: number | null,
  cookies: CookieEntry[] | null,
): Promise<void> {
  try {
    const result = await source.open(input, { timestampSeconds, cookies });
    showToast('Opening in MPV...', 'success', result.resolvedUrl);
  } catch (error) {
    if (error instanceof InvalidVideoInputError) {
      // error.message embeds the raw input that failed validation — never logged, per this
      // project's own rule against logging video URLs/ids to the console.
      console.error('[Stream to MPV] video source rejected the resolved URL as invalid');
      showToast('Failed to extract video URL', 'error');
      return;
    }
    if (error instanceof MpvHandlerError) {
      console.error('[Stream to MPV] handler unreachable:', error.message);
      const command = buildMpvShellCommand(input, timestampSeconds, {
        mpvPath: getConfig('mpvPath'),
        platform: getPlatform(navigator.platform),
      });
      const { copied } = await copyToClipboard(command);
      showToast(
        copied ? `Handler offline. Copied: ${command}` : `Run: ${command}`,
        'warning',
        command,
      );
      return;
    }
    throw error;
  }
}

if (window.location.hostname.includes('twitch.tv')) {
  const twitchSource = new TwitchSource(client);
  initTwitchUserscriptUi({
    openInMpv: (input, timestampSeconds, cookies) =>
      openInMpv(twitchSource, input, timestampSeconds, cookies),
  });
} else {
  const youtubeSource = new YoutubeSource(client);
  initUserscriptUi({
    // YouTube never sources cookies today — no GM_cookie call on this path, by design (see
    // twitchCookies.ts's own doc comment on why that domain scoping must stay per-platform).
    openInMpv: (videoUrl, timestampSeconds) =>
      openInMpv(youtubeSource, videoUrl, timestampSeconds, null),
  });
}
