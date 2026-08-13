import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { injectButton, removeButton, type DomCallbacks } from './dom.js';

function stubGmValue(showButton: boolean): void {
  vi.stubGlobal(
    'GM_getValue',
    vi.fn((key: string, defaultValue: unknown) =>
      key === 'showButton' ? showButton : defaultValue,
    ),
  );
}

describe('injectButton / removeButton', () => {
  let callbacks: DomCallbacks;

  beforeEach(() => {
    document.body.innerHTML = '<div class="ytp-right-controls"></div>';
    callbacks = { openInMpv: vi.fn() };
    stubGmValue(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('prepends the button into .ytp-right-controls', () => {
    injectButton(callbacks);

    const btn = document.getElementById('mpv-open-btn');
    expect(btn).not.toBeNull();
    expect(btn?.parentElement).toHaveProperty('className', 'ytp-right-controls');
  });

  it('does not inject a second button on repeat calls', () => {
    injectButton(callbacks);
    injectButton(callbacks);

    expect(document.querySelectorAll('#mpv-open-btn')).toHaveLength(1);
  });

  it('does not inject when showButton is disabled', () => {
    stubGmValue(false);
    injectButton(callbacks);

    expect(document.getElementById('mpv-open-btn')).toBeNull();
  });

  it('does nothing when .ytp-right-controls is not present', () => {
    document.body.innerHTML = '';
    injectButton(callbacks);

    expect(document.getElementById('mpv-open-btn')).toBeNull();
  });

  it('removeButton removes a previously injected button', () => {
    injectButton(callbacks);
    expect(document.getElementById('mpv-open-btn')).not.toBeNull();

    removeButton();

    expect(document.getElementById('mpv-open-btn')).toBeNull();
  });

  it('removeButton is a no-op when no button is present', () => {
    expect(() => removeButton()).not.toThrow();
  });

  it('clicking the button calls openInMpv with the page video URL, null timestamp, and null cookies (GM_cookie unavailable)', async () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
      writable: true,
    });
    injectButton(callbacks);

    document
      .getElementById('mpv-open-btn')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await vi.waitFor(() => expect(callbacks.openInMpv).toHaveBeenCalled());
    expect(callbacks.openInMpv).toHaveBeenCalledWith(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      null,
      null,
    );
  });

  it('clicking the button forwards cookies merged from both youtube.com and google.com', async () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
      writable: true,
    });
    const youtubeCookie: GMCookie = {
      domain: '.youtube.com',
      name: 'PREF',
      value: 'yt-pref',
      path: '/',
      secure: true,
      httpOnly: false,
      session: false,
      expirationDate: 1750000000,
    };
    const googleCookie: GMCookie = {
      domain: '.google.com',
      name: 'SID',
      value: 'secret',
      path: '/',
      secure: true,
      httpOnly: true,
      session: false,
      expirationDate: 1750000001,
    };
    vi.stubGlobal('GM_cookie', {
      list: (
        details: GMCookieListDetails,
        callback: (cookies: GMCookie[], error: string | null) => void,
      ) => {
        callback(details.domain === 'google.com' ? [googleCookie] : [youtubeCookie], null);
      },
    });
    injectButton(callbacks);

    document
      .getElementById('mpv-open-btn')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await vi.waitFor(() => expect(callbacks.openInMpv).toHaveBeenCalled());
    expect(callbacks.openInMpv).toHaveBeenCalledWith(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      null,
      [
        {
          domain: '.youtube.com',
          name: 'PREF',
          value: 'yt-pref',
          path: '/',
          secure: true,
          httpOnly: false,
          expirationDate: 1750000000,
        },
        {
          domain: '.google.com',
          name: 'SID',
          value: 'secret',
          path: '/',
          secure: true,
          httpOnly: true,
          expirationDate: 1750000001,
        },
      ],
    );
  });
});
