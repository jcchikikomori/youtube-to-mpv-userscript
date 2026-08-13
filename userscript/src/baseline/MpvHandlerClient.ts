// INVARIANT: never import child_process here or anywhere under src/. mpv launching happens
// exclusively inside mpv-handler.py via subprocess.Popen — this client only ever performs HTTP
// requests. Enforced by test/no-child-process.test.ts and the no-restricted-imports lint rule.
import {
  MpvHandlerHttpError,
  MpvHandlerResponseError,
  MpvHandlerTimeoutError,
  MpvHandlerUnreachableError,
} from './errors.js';
import { sanitizeCookiesForWire } from './cookies.js';
import { assertLoopbackUrl } from './loopback.js';
import {
  HealthResponseSchema,
  PlayResponseSchema,
  type HealthResponse,
  type PlayResponse,
} from './schemas.js';
import type {
  FetchLike,
  FetchResponseLike,
  MpvHandlerClientOptions,
  PlayOptions,
  Validator,
} from './types.js';

const DEFAULT_BASE_URL = 'http://127.0.0.1:38421';
const DEFAULT_TIMEOUT_MS = 5000;

function hasStringMessage(value: unknown): value is { message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof value.message === 'string'
  );
}

/** Thin HTTP client for mpv-handler.py. Knows nothing about any specific video platform. */
export class MpvHandlerClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(options: MpvHandlerClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;

    if (options.allowNonLoopback) {
      console.warn(
        `[YouTube to MPV] MpvHandlerClient constructed with allowNonLoopback=true for baseUrl "${this.baseUrl}" — the loopback SSRF guard is disabled for this instance.`,
      );
    } else {
      assertLoopbackUrl(this.baseUrl);
    }
  }

  /**
   * Requests mpv-handler.py to launch mpv on the given URL. Validates timestampSeconds and
   * cookies synchronously before any request is sent — deliberately stricter than the Python
   * handler, which silently logs-and-ignores an invalid `t` and still returns 200.
   *
   * Always POSTs a JSON body (never a GET query string): cookies must never end up in a URL,
   * where they'd be exposed to request-line logging (this client's own, any proxy's, or
   * mpv-handler.py's) — see cookies.ts. The video URL travels the same way for consistency,
   * even on the no-cookies path.
   */
  async play(url: string, options: PlayOptions = {}): Promise<PlayResponse> {
    const timestampSeconds = options.timestampSeconds ?? null;
    if (
      timestampSeconds !== null &&
      !(Number.isFinite(timestampSeconds) && timestampSeconds >= 0)
    ) {
      throw new RangeError(
        `timestampSeconds must be a finite number >= 0, got ${String(timestampSeconds)}`,
      );
    }
    const cookies = sanitizeCookiesForWire(options.cookies);

    return this.requestJson(
      '/play',
      {
        url,
        t: timestampSeconds !== null ? String(timestampSeconds) : undefined,
        cookies: cookies ?? undefined,
      },
      PlayResponseSchema,
    );
  }

  async health(): Promise<HealthResponse> {
    return this.request('/health', {}, HealthResponseSchema);
  }

  private buildRequestUrl(path: string, query: Record<string, string | undefined>): string {
    const parts = Object.entries(query)
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`);
    const queryString = parts.length > 0 ? `?${parts.join('&')}` : '';
    return `${this.baseUrl}${path}${queryString}`;
  }

  /** GET with the query string in the URL. Used only by health() — never a body-carrying request. */
  private async request<T>(
    path: string,
    query: Record<string, string | undefined>,
    schema: Validator<T>,
  ): Promise<T> {
    const response = await this.fetch(this.buildRequestUrl(path, query), path, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return this.parseResponse(response, schema);
  }

  /**
   * POST with a JSON body. Used by play() so cookies/URL never appear in a query string —
   * see play()'s own doc comment for why that matters.
   */
  private async requestJson<T>(
    path: string,
    body: Record<string, unknown>,
    schema: Validator<T>,
  ): Promise<T> {
    const response = await this.fetch(`${this.baseUrl}${path}`, path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return this.parseResponse(response, schema);
  }

  private async fetch(
    requestUrl: string,
    path: string,
    init: NonNullable<Parameters<FetchLike>[1]>,
  ): Promise<FetchResponseLike> {
    try {
      return await this.fetchImpl(requestUrl, init);
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        // Message intentionally omits the query string/body (either can carry the video
        // URL/cookies) — never log that to the console. this.baseUrl + path identifies the
        // request just as well for debugging without it.
        throw new MpvHandlerTimeoutError(
          `mpv-handler did not respond within ${this.timeoutMs}ms (${this.baseUrl}${path})`,
          { cause: error },
        );
      }
      throw new MpvHandlerUnreachableError(`mpv-handler unreachable at ${this.baseUrl}`, {
        cause: error,
      });
    }
  }

  private async parseResponse<T>(response: FetchResponseLike, schema: Validator<T>): Promise<T> {
    const text = await response.text();
    let rawBody: unknown;
    try {
      rawBody = text.length > 0 ? JSON.parse(text) : undefined;
    } catch (error) {
      throw new MpvHandlerResponseError(`mpv-handler returned a non-JSON response`, {
        cause: error,
      });
    }

    if (!response.ok) {
      const message = hasStringMessage(rawBody) ? rawBody.message : `HTTP ${response.status}`;
      throw new MpvHandlerHttpError(
        `mpv-handler rejected the request: ${message}`,
        response.status,
        rawBody,
      );
    }

    const parsed = schema.safeParse(rawBody);
    if (!parsed.success) {
      throw new MpvHandlerResponseError(
        `mpv-handler response failed validation: ${parsed.error.message}`,
      );
    }
    return parsed.data;
  }
}
