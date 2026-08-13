import { MpvHandlerClient } from '../baseline/MpvHandlerClient.js';
import { MpvHandlerError } from '../baseline/errors.js';
import { InvalidVideoInputError } from '../contracts/errors.js';
import { YoutubeSource } from '../platforms/youtube/YoutubeSource.js';
import { buildMpvShellCommand, copyToClipboard } from './clipboardFallback.js';
import { getConfig } from './config.js';
import { initUserscriptUi } from './dom.js';
import { gmFetch } from './gmFetch.js';
import { getPlatform } from './platform.js';
import { showToast } from './toast.js';

const client = new MpvHandlerClient({ fetchImpl: gmFetch });
const youtubeSource = new YoutubeSource(client);

/**
 * Called by dom.ts once it has already resolved a validated, canonical watch URL — dom.ts
 * owns the "couldn't extract a video URL at all" case itself (shows its own error toast,
 * never calls this). Every failure path below is a network/handler problem instead, so they
 * all fall back to the clipboard the same way the original hand-written script did for any
 * non-200 response.
 */
async function openInMpv(videoUrl: string, timestampSeconds: number | null): Promise<void> {
  try {
    await youtubeSource.open(videoUrl, { timestampSeconds });
    showToast('Opening in MPV...', 'success');
  } catch (error) {
    if (error instanceof InvalidVideoInputError) {
      console.error('[YouTube to MPV]', error.message);
      showToast('Failed to extract video URL', 'error');
      return;
    }
    if (error instanceof MpvHandlerError) {
      console.error('[YouTube to MPV] handler unreachable:', error.message);
      const command = buildMpvShellCommand(videoUrl, timestampSeconds, {
        mpvPath: getConfig('mpvPath'),
        platform: getPlatform(navigator.platform),
      });
      const { copied } = await copyToClipboard(command);
      showToast(copied ? `Handler offline. Copied: ${command}` : `Run: ${command}`, 'warning');
      return;
    }
    throw error;
  }
}

initUserscriptUi({ openInMpv });
