import { describe, expect, it, vi } from 'vitest';
import type { MpvHandlerClient } from '../baseline/MpvHandlerClient.js';
import { AbstractVideoSource } from './AbstractVideoSource.js';
import { InvalidVideoInputError } from './errors.js';

class FakeSource extends AbstractVideoSource {
  readonly platform = 'fake';

  supports(input: string): boolean {
    return input === 'valid';
  }

  resolveUrl(input: string): string | null {
    return input === 'valid' ? 'https://example.com/valid' : null;
  }
}

function fakeClient(play = vi.fn().mockResolvedValue({ status: 'ok' })) {
  return { play } as unknown as MpvHandlerClient;
}

describe('AbstractVideoSource#open', () => {
  it('resolves the input, calls client.play, and returns the open result', async () => {
    const play = vi.fn().mockResolvedValue({ status: 'ok' });
    const source = new FakeSource(fakeClient(play));

    const result = await source.open('valid', { timestampSeconds: 42 });

    expect(result).toEqual({ resolvedUrl: 'https://example.com/valid', timestampSeconds: 42 });
    expect(play).toHaveBeenCalledWith('https://example.com/valid', { timestampSeconds: 42 });
  });

  it('defaults timestampSeconds to null when not given', async () => {
    const play = vi.fn().mockResolvedValue({ status: 'ok' });
    const source = new FakeSource(fakeClient(play));

    const result = await source.open('valid');

    expect(result.timestampSeconds).toBeNull();
    expect(play).toHaveBeenCalledWith('https://example.com/valid', { timestampSeconds: null });
  });

  it('throws InvalidVideoInputError without calling client.play when resolveUrl returns null', async () => {
    const play = vi.fn();
    const source = new FakeSource(fakeClient(play));

    await expect(source.open('garbage')).rejects.toBeInstanceOf(InvalidVideoInputError);
    expect(play).not.toHaveBeenCalled();
  });
});
