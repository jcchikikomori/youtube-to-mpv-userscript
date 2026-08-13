import type { MpvHandlerClient } from '../baseline/MpvHandlerClient.js';
import { InvalidVideoInputError } from './errors.js';
import type { OpenOptions, OpenResult, VideoSource } from './VideoSource.js';

/**
 * Template-method base: fixes the shared open() skeleton (resolve -> validate -> client.play()
 * -> shape result) so platform modules never duplicate it. Composes MpvHandlerClient (HAS-A),
 * never extends it (IS-A) — extending would leak transport concerns into every platform and
 * make it impossible for multiple platform sources to share one configured client instance.
 */
export abstract class AbstractVideoSource implements VideoSource {
  abstract readonly platform: string;
  protected readonly client: MpvHandlerClient;

  constructor(client: MpvHandlerClient) {
    this.client = client;
  }

  abstract supports(input: string): boolean;
  abstract resolveUrl(input: string): string | null;

  async open(input: string, options: OpenOptions = {}): Promise<OpenResult> {
    const resolvedUrl = this.resolveUrl(input);
    if (!resolvedUrl) {
      throw new InvalidVideoInputError(`${this.platform}: not a valid URL or ID: ${input}`);
    }
    const timestampSeconds = options.timestampSeconds ?? null;
    const cookies = options.cookies ?? null;
    await this.client.play(resolvedUrl, { timestampSeconds, cookies });
    return { resolvedUrl, timestampSeconds };
  }
}
