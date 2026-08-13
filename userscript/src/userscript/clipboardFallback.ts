import type { Platform } from './platform.js';

export interface ShellCommandOptions {
  mpvPath?: string;
  platform?: Platform;
}

/** Pure. Relocated from the old Node CLI's clipboardFallback.ts — already platform-parametrized. */
export function buildMpvShellCommand(
  url: string,
  timestampSeconds: number | null,
  options: ShellCommandOptions = {},
): string {
  const mpvPath = options.mpvPath ?? 'mpv';
  const isWindows = options.platform === 'windows';
  const startArg = timestampSeconds !== null ? ` --start=${timestampSeconds}` : '';
  return isWindows ? `${mpvPath} "${url}"${startArg}` : `${mpvPath} '${url}'${startArg}`;
}

export interface ClipboardCopyResult {
  copied: boolean;
}

/** Best-effort clipboard write via the browser API. Failure is reported, not thrown. */
export async function copyToClipboard(text: string): Promise<ClipboardCopyResult> {
  try {
    await navigator.clipboard.writeText(text);
    return { copied: true };
  } catch {
    return { copied: false };
  }
}
