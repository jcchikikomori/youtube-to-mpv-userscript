import type { VideoSource } from './contracts/VideoSource.js';

/**
 * Picks a VideoSource for a given input. Adding a future platform (e.g. Twitch) means only
 * constructing it alongside the existing sources here — nothing about the registry itself
 * needs to change.
 */
export class VideoSourceRegistry {
  private readonly sources: readonly VideoSource[];

  constructor(sources: readonly VideoSource[]) {
    this.sources = sources;
  }

  /** First registered source whose supports() returns true for this input, or null. */
  find(input: string): VideoSource | null {
    return this.sources.find((source) => source.supports(input)) ?? null;
  }

  /** Looks up a source by its exact platform name — used for the CLI's --platform override. */
  get(platform: string): VideoSource | null {
    return this.sources.find((source) => source.platform === platform) ?? null;
  }

  list(): readonly VideoSource[] {
    return this.sources;
  }
}
