# Twitch (planned, not implemented)

Twitch is already fully playable via mpv/yt-dlp — this module just hasn't been written yet.
The baseline (`../../baseline/`) and contracts (`../../contracts/`) layers were designed so
adding it requires **zero edits to either**. This file is the recipe for when it's time.

## Steps

1. Create these files, mirroring `../youtube/`:
   - `validation.ts` — Twitch equivalents of `isValidYoutubeUrl`/`extractYoutubeVideoId`. Twitch
     channels/VODs/clips each have a different URL shape
     (`twitch.tv/<channel>`, `twitch.tv/videos/<id>`, `clips.twitch.tv/<slug>`), so this will
     likely need one extractor per shape rather than a single regex — same principle as
     `youtube/validation.ts`'s single `extractIdFromParsedUrl` helper: **one** function every
     other check derives from, so `supports()` and `resolveUrl()` can never disagree.
   - `timestamp.ts` — Twitch VOD timestamps use their own format (`?t=1h2m3s` on VOD URLs is
     close to YouTube's legacy form, but confirm against Twitch's actual query format before
     assuming it's identical).
   - `TwitchSource.ts` — `export class TwitchSource extends AbstractVideoSource`, implementing
     `platform`, `supports()`, `resolveUrl()`, and optionally `parseTimestamp()`. `open()` is
     inherited from `AbstractVideoSource` — do not reimplement it.
   - `index.ts` — re-export `TwitchSource` and the validation/timestamp helpers, matching
     `youtube/index.ts`.
2. Wire it up: the current userscript (`src/userscript/main.ts`) only ever constructs a single
   `YoutubeSource` directly — it's a single-site bundle, so there's nothing to dispatch between
   and no `VideoSourceRegistry` in use there. A Twitch userscript would most likely be its own
   bundle (own `src/userscript-twitch/` entry + its own `tsup.config.ts` entry, since the DOM/UI
   layer is YouTube-page-specific), constructing its own `TwitchSource` the same way — reach for
   `VideoSourceRegistry` only if something ever needs to dispatch between multiple platforms
   from one entry point.
3. Re-export it from the library root: one line in `src/index.ts`.
4. Add `src/platforms/twitch/validation.test.ts`, `timestamp.test.ts`, `TwitchSource.test.ts`,
   following the same shape as the YouTube module's tests (table-driven validation cases
   including adversarial URLs, a fake `MpvHandlerClient` for `TwitchSource` tests — never a
   real HTTP call).

## What should NOT change

- `src/baseline/**` — the HTTP client has no notion of "platform" and shouldn't gain one.
- `src/contracts/**` — the `VideoSource` interface and `AbstractVideoSource` template method
  already cover everything a live-stream-vs-VOD distinction needs (`resolveUrl()` can return a
  channel's live URL or a VOD URL — mpv/yt-dlp handles both the same way once it has a URL).
- `src/platforms/youtube/**` — no cross-platform sharing beyond what's already in `contracts/`.
