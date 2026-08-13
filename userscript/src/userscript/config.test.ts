import { afterEach, describe, expect, it, vi } from 'vitest';
import { getConfig, setConfig } from './config.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getConfig', () => {
  it('falls back to the documented default when GM_getValue has nothing stored', () => {
    vi.stubGlobal(
      'GM_getValue',
      vi.fn((_key: string, defaultValue: unknown) => defaultValue),
    );

    expect(getConfig('mpvPath')).toBe('mpv');
    expect(getConfig('showButton')).toBe(true);
    expect(getConfig('autoPlaylist')).toBe(false);
    expect(getConfig('enableNativeMenuItems')).toBe(true);
  });

  it('returns whatever GM_getValue reports when a value is stored', () => {
    vi.stubGlobal(
      'GM_getValue',
      vi.fn((key: string) => (key === 'showButton' ? false : undefined)),
    );

    expect(getConfig('showButton')).toBe(false);
  });
});

describe('setConfig', () => {
  it('forwards key/value to GM_setValue', () => {
    const setValue = vi.fn();
    vi.stubGlobal('GM_setValue', setValue);

    setConfig('showButton', false);

    expect(setValue).toHaveBeenCalledWith('showButton', false);
  });
});
