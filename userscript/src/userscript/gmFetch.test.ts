import { afterEach, describe, expect, it, vi } from 'vitest';
import { gmFetch } from './gmFetch.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('gmFetch', () => {
  it('resolves ok:true for a 2xx GM_xmlhttpRequest response', async () => {
    vi.stubGlobal(
      'GM_xmlhttpRequest',
      vi.fn((details: GMXmlHttpRequestDetails) => {
        details.onload?.({
          status: 200,
          responseText: '{"status":"ok"}',
          finalUrl: 'http://127.0.0.1:38421/play?url=x',
        });
        return { abort: vi.fn() };
      }),
    );

    const response = await gmFetch('http://127.0.0.1:38421/play?url=x');

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe('{"status":"ok"}');
  });

  it('resolves ok:false for a non-2xx GM_xmlhttpRequest response', async () => {
    vi.stubGlobal(
      'GM_xmlhttpRequest',
      vi.fn((details: GMXmlHttpRequestDetails) => {
        details.onload?.({
          status: 500,
          responseText: '{"status":"error"}',
          finalUrl: 'http://127.0.0.1:38421/play?url=x',
        });
        return { abort: vi.fn() };
      }),
    );

    const response = await gmFetch('http://127.0.0.1:38421/play?url=x');

    expect(response.ok).toBe(false);
    expect(response.status).toBe(500);
  });

  it('rejects when the response arrives via a redirect to a non-loopback URL', async () => {
    vi.stubGlobal(
      'GM_xmlhttpRequest',
      vi.fn((details: GMXmlHttpRequestDetails) => {
        details.onload?.({
          status: 200,
          responseText: '{"status":"ok"}',
          finalUrl: 'http://evil.example.com/play?url=x',
        });
        return { abort: vi.fn() };
      }),
    );

    await expect(gmFetch('http://127.0.0.1:38421/play?url=x')).rejects.toThrow(/non-loopback/);
  });

  it('rejects when GM_xmlhttpRequest reports onerror', async () => {
    vi.stubGlobal(
      'GM_xmlhttpRequest',
      vi.fn((details: GMXmlHttpRequestDetails) => {
        details.onerror?.(undefined);
        return { abort: vi.fn() };
      }),
    );

    await expect(gmFetch('http://127.0.0.1:38421/play?url=x')).rejects.toThrow(
      /GM_xmlhttpRequest network error/,
    );
  });

  it('aborts the underlying request and rejects with signal.reason when init.signal fires', async () => {
    const abort = vi.fn();
    vi.stubGlobal(
      'GM_xmlhttpRequest',
      vi.fn(() => ({ abort })),
    );

    const controller = new AbortController();
    const promise = gmFetch('http://127.0.0.1:38421/play?url=x', { signal: controller.signal });
    const reason = new DOMException('timed out', 'TimeoutError');
    controller.abort(reason);

    await expect(promise).rejects.toBe(reason);
    expect(abort).toHaveBeenCalledOnce();
  });
});
