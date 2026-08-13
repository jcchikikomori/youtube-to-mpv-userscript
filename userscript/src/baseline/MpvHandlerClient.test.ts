import { describe, expect, it, vi } from 'vitest';
import { MpvHandlerClient } from './MpvHandlerClient.js';
import {
  MpvHandlerHttpError,
  MpvHandlerResponseError,
  MpvHandlerTimeoutError,
  MpvHandlerUnreachableError,
} from './errors.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Mimics real fetch's cooperative behavior with AbortSignal, without ever resolving on its own. */
function neverRespondingFetch(): typeof fetch {
  return vi.fn((_input: string | URL | Request, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        // Mirrors real fetch's behavior of rejecting with signal.reason as-is (a DOMException).
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        reject(init.signal?.reason);
      });
    });
  });
}

function networkErrorFetch(): typeof fetch {
  return vi.fn(async () => {
    throw new TypeError('fetch failed', { cause: new Error('connect ECONNREFUSED') });
  });
}

describe('MpvHandlerClient constructor', () => {
  it('defaults to the documented loopback base URL', () => {
    expect(() => new MpvHandlerClient()).not.toThrow();
  });

  it('rejects a non-loopback baseUrl by default', () => {
    expect(() => new MpvHandlerClient({ baseUrl: 'http://evil.com:38421' })).toThrow(RangeError);
  });

  it('allows a non-loopback baseUrl when allowNonLoopback is set, and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(
      () => new MpvHandlerClient({ baseUrl: 'http://evil.com:38421', allowNonLoopback: true }),
    ).not.toThrow();
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });
});

describe('MpvHandlerClient#play', () => {
  it('builds the request URL with url always present and t only when given', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ status: 'ok' })) as unknown as typeof fetch;
    const client = new MpvHandlerClient({ fetchImpl });

    await client.play('https://www.youtube.com/watch?v=abc&extra=1');

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:38421/play?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dabc%26extra%3D1',
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it('appends an encoded t parameter when a timestamp is given', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ status: 'ok' })) as unknown as typeof fetch;
    const client = new MpvHandlerClient({ fetchImpl });

    await client.play('https://www.youtube.com/watch?v=abc', { timestampSeconds: 12.5 });

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:38421/play?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dabc&t=12.5',
      expect.anything(),
    );
  });

  it.each([-1, NaN, Infinity])(
    'rejects synchronously on an invalid timestamp (%s) without calling fetch',
    async (timestampSeconds) => {
      const fetchImpl = vi.fn() as unknown as typeof fetch;
      const client = new MpvHandlerClient({ fetchImpl });

      await expect(
        client.play('https://www.youtube.com/watch?v=abc', { timestampSeconds }),
      ).rejects.toThrow(RangeError);
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('resolves with the parsed body on a 200 ok response', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ status: 'ok' })) as unknown as typeof fetch;
    const client = new MpvHandlerClient({ fetchImpl });

    await expect(client.play('https://www.youtube.com/watch?v=abc')).resolves.toEqual({
      status: 'ok',
    });
  });

  it('throws MpvHandlerHttpError on a non-2xx response, surfacing the handler message', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ status: 'error', message: 'mpv not found' }, 500),
    ) as unknown as typeof fetch;
    const client = new MpvHandlerClient({ fetchImpl });

    const error = await client.play('https://www.youtube.com/watch?v=abc').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MpvHandlerHttpError);
    expect((error as MpvHandlerHttpError).statusCode).toBe(500);
    expect((error as MpvHandlerHttpError).message).toContain('mpv not found');
  });

  it('throws MpvHandlerResponseError on malformed JSON', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('not json', { status: 200 }),
    ) as unknown as typeof fetch;
    const client = new MpvHandlerClient({ fetchImpl });

    await expect(client.play('https://www.youtube.com/watch?v=abc')).rejects.toBeInstanceOf(
      MpvHandlerResponseError,
    );
  });

  it('throws MpvHandlerResponseError when a 2xx body fails schema validation', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ status: 'ok', extra: true }),
    ) as unknown as typeof fetch;
    const client = new MpvHandlerClient({ fetchImpl });

    await expect(client.play('https://www.youtube.com/watch?v=abc')).rejects.toBeInstanceOf(
      MpvHandlerResponseError,
    );
  });

  it('throws MpvHandlerUnreachableError when fetch rejects with a network error', async () => {
    const client = new MpvHandlerClient({ fetchImpl: networkErrorFetch() });

    await expect(client.play('https://www.youtube.com/watch?v=abc')).rejects.toBeInstanceOf(
      MpvHandlerUnreachableError,
    );
  });

  it('throws MpvHandlerTimeoutError when the request exceeds timeoutMs', async () => {
    const client = new MpvHandlerClient({ fetchImpl: neverRespondingFetch(), timeoutMs: 30 });

    await expect(client.play('https://www.youtube.com/watch?v=abc')).rejects.toBeInstanceOf(
      MpvHandlerTimeoutError,
    );
  });
});

describe('MpvHandlerClient#health', () => {
  it('resolves on the documented running status', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ status: 'running' }),
    ) as unknown as typeof fetch;
    const client = new MpvHandlerClient({ fetchImpl });

    await expect(client.health()).resolves.toEqual({ status: 'running' });
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:38421/health', expect.anything());
  });
});
