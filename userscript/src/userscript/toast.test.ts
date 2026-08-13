import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { showToast } from './toast.js';

function stubMatchMedia(matchesDark: boolean): void {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: matchesDark }));
}

describe('showToast', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    stubMatchMedia(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the message text', () => {
    showToast('Opening in MPV...', 'success');

    expect(document.getElementById('mpv-toast')?.textContent).toContain('Opening in MPV...');
  });

  it('replaces an existing toast instead of stacking', () => {
    showToast('first', 'success');
    showToast('second', 'success');

    const toasts = document.querySelectorAll('#mpv-toast');
    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.textContent).toContain('second');
  });

  it('uses the error background regardless of color scheme', () => {
    showToast('boom', 'error');

    expect(document.getElementById('mpv-toast')?.style.background).toBe('#e74c3c');
  });

  it('uses the light background in light mode for non-error toasts', () => {
    stubMatchMedia(false);
    showToast('ok', 'success');

    expect(document.getElementById('mpv-toast')?.style.background).toBe('#fff');
  });

  it('uses the dark background in dark mode for non-error toasts', () => {
    stubMatchMedia(true);
    showToast('ok', 'success');

    expect(document.getElementById('mpv-toast')?.style.background).toBe('#333');
  });

  it('copies the message via the Copy button', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    showToast('mpv url', 'success');
    const copyBtn = document.querySelector<HTMLButtonElement>('#mpv-toast button');
    copyBtn?.click();

    expect(writeText).toHaveBeenCalledWith('mpv url');
  });
});
