import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildMpvShellCommand, copyToClipboard } from './clipboardFallback.js';

describe('buildMpvShellCommand', () => {
  it('quotes with single quotes and omits --start by default', () => {
    expect(buildMpvShellCommand('https://youtu.be/x', null)).toBe("mpv 'https://youtu.be/x'");
  });

  it('quotes with double quotes on windows', () => {
    expect(buildMpvShellCommand('https://youtu.be/x', null, { platform: 'windows' })).toBe(
      'mpv "https://youtu.be/x"',
    );
  });

  it('appends --start when a timestamp is given', () => {
    expect(buildMpvShellCommand('https://youtu.be/x', 90)).toBe(
      "mpv 'https://youtu.be/x' --start=90",
    );
  });

  it('honors a custom mpvPath', () => {
    expect(buildMpvShellCommand('https://youtu.be/x', null, { mpvPath: '/usr/bin/mpv' })).toBe(
      "/usr/bin/mpv 'https://youtu.be/x'",
    );
  });
});

describe('copyToClipboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports copied:true on success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await expect(copyToClipboard('mpv url')).resolves.toEqual({ copied: true });
    expect(writeText).toHaveBeenCalledWith('mpv url');
  });

  it('reports copied:false when the clipboard write throws', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await expect(copyToClipboard('mpv url')).resolves.toEqual({ copied: false });
  });
});
