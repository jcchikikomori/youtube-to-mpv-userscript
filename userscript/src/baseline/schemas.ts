import type { Validator } from './types.js';

export interface PlayResponse {
  status: 'ok' | 'error';
  message?: string;
}

export interface HealthResponse {
  status: 'running';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function findUnexpectedKey(value: Record<string, unknown>, allowedKeys: readonly string[]): string | undefined {
  return Object.keys(value).find((key) => !allowedKeys.includes(key));
}

/**
 * Handler JSON is parsed with JSON.parse and validated strictly (rejects unexpected extra keys)
 * before any field is touched — treated as untrusted even though it's local (defense in depth
 * against something else squatting on the handler's port before the real process starts).
 */
export const PlayResponseSchema: Validator<PlayResponse> = {
  safeParse(value) {
    if (!isPlainObject(value)) {
      return { success: false, error: { message: 'expected an object' } };
    }
    const unexpectedKey = findUnexpectedKey(value, ['status', 'message']);
    if (unexpectedKey) {
      return { success: false, error: { message: `unexpected key "${unexpectedKey}"` } };
    }
    if (value.status !== 'ok' && value.status !== 'error') {
      return { success: false, error: { message: 'status must be "ok" or "error"' } };
    }
    if (value.message !== undefined && typeof value.message !== 'string') {
      return { success: false, error: { message: 'message must be a string' } };
    }
    return {
      success: true,
      data: value.message !== undefined ? { status: value.status, message: value.message } : { status: value.status },
    };
  },
};

export const HealthResponseSchema: Validator<HealthResponse> = {
  safeParse(value) {
    if (!isPlainObject(value)) {
      return { success: false, error: { message: 'expected an object' } };
    }
    const unexpectedKey = findUnexpectedKey(value, ['status']);
    if (unexpectedKey) {
      return { success: false, error: { message: `unexpected key "${unexpectedKey}"` } };
    }
    if (value.status !== 'running') {
      return { success: false, error: { message: 'status must be "running"' } };
    }
    return { success: true, data: { status: 'running' } };
  },
};
