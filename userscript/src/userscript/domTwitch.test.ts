import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { injectButton, removeButton, type TwitchDomCallbacks } from './domTwitch.js';

function stubGmValue(showButton: boolean): void {
  vi.stubGlobal(
    'GM_getValue',
    vi.fn((key: string, defaultValue: unknown) =>
      key === 'showButton' ? showButton : defaultValue,
    ),
  );
}

describe('injectButton / removeButton (Twitch)', () => {
  let callbacks: TwitchDomCallbacks;

  beforeEach(() => {
    document.body.innerHTML = '<div class="player-controls__right-control-group"></div>';
    callbacks = { openInMpv: vi.fn() };
    stubGmValue(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('prepends the button into .player-controls__right-control-group', () => {
    injectButton(callbacks);

    const btn = document.getElementById('mpv-open-btn-twitch');
    expect(btn).not.toBeNull();
    expect(btn?.parentElement).toHaveProperty('className', 'player-controls__right-control-group');
  });

  it('does not inject a second button on repeat calls', () => {
    injectButton(callbacks);
    injectButton(callbacks);

    expect(document.querySelectorAll('#mpv-open-btn-twitch')).toHaveLength(1);
  });

  it('does not inject when showButton is disabled', () => {
    stubGmValue(false);
    injectButton(callbacks);

    expect(document.getElementById('mpv-open-btn-twitch')).toBeNull();
  });

  it('does nothing when .player-controls__right-control-group is not present', () => {
    document.body.innerHTML = '';
    injectButton(callbacks);

    expect(document.getElementById('mpv-open-btn-twitch')).toBeNull();
  });

  it('removeButton removes a previously injected button', () => {
    injectButton(callbacks);
    expect(document.getElementById('mpv-open-btn-twitch')).not.toBeNull();

    removeButton();

    expect(document.getElementById('mpv-open-btn-twitch')).toBeNull();
  });

  it('removeButton is a no-op when no button is present', () => {
    expect(() => removeButton()).not.toThrow();
  });

  it('clicking the button calls openInMpv with the resolved channel URL, null timestamp, and null cookies (GM_cookie unavailable)', async () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.twitch.tv/some_streamer'),
      writable: true,
    });
    injectButton(callbacks);

    document
      .getElementById('mpv-open-btn-twitch')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await vi.waitFor(() => expect(callbacks.openInMpv).toHaveBeenCalled());
    expect(callbacks.openInMpv).toHaveBeenCalledWith(
      'https://www.twitch.tv/some_streamer',
      null,
      null,
    );
  });

  it('clicking the button forwards cookies when GM_cookie provides them', async () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.twitch.tv/some_streamer'),
      writable: true,
    });
    const rawCookie: GMCookie = {
      domain: '.twitch.tv',
      name: 'auth-token',
      value: 'secret',
      path: '/',
      secure: true,
      httpOnly: true,
      session: false,
      expirationDate: 1750000000,
    };
    vi.stubGlobal('GM_cookie', {
      list: (
        _details: GMCookieListDetails,
        callback: (cookies: GMCookie[], error: string | null) => void,
      ) => {
        callback([rawCookie], null);
      },
    });
    injectButton(callbacks);

    document
      .getElementById('mpv-open-btn-twitch')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await vi.waitFor(() => expect(callbacks.openInMpv).toHaveBeenCalled());
    expect(callbacks.openInMpv).toHaveBeenCalledWith('https://www.twitch.tv/some_streamer', null, [
      {
        domain: '.twitch.tv',
        name: 'auth-token',
        value: 'secret',
        path: '/',
        secure: true,
        httpOnly: true,
        expirationDate: 1750000000,
      },
    ]);
  });

  it('does not call openInMpv when the current page is not a valid channel/VOD URL', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.twitch.tv/settings'),
      writable: true,
    });
    injectButton(callbacks);

    document
      .getElementById('mpv-open-btn-twitch')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(callbacks.openInMpv).not.toHaveBeenCalled();
  });
});
