// YouTube embeds this on every watch page. Kept separate from gm-globals.d.ts since it's a
// page-provided global, not a Tampermonkey API.
interface Window {
  ytInitialPlayerResponse?: {
    videoDetails?: {
      videoId?: string;
    };
  };
}
