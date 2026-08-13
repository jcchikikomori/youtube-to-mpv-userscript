import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const isTestBuild = process.env.USERSCRIPT_BUILD === 'test';
const outputName = isTestBuild ? 'youtube-to-mpv.test' : 'youtube-to-mpv';

/**
 * A testing build gets its own @name (Tampermonkey installs it as a separate script instead of
 * overwriting/updating the real one) and drops @updateURL/@installURL (so Tampermonkey never
 * auto-updates a local test install back to the published version).
 */
function buildMetadataBlock(): string {
  const block = readFileSync('src/userscript/metadata.txt', 'utf-8');
  if (!isTestBuild) return block;

  return block
    .replace(/^(\/\/ @name\s+.+)$/m, '$1 (Testing)')
    .replace(/^\/\/ @(?:updateURL|installURL).*\n/gm, '');
}

export default defineConfig({
  entry: { [outputName]: 'src/userscript/main.ts' },
  format: ['iife'],
  platform: 'browser',
  target: 'es2020',
  outExtension: () => ({ js: '.user.js' }),
  banner: { js: buildMetadataBlock() },
  // Not `true`: tsup's clean wipes the whole outDir regardless of entry name (an array is
  // *additional* patterns on top of that, not a narrower scope) — that would delete the
  // production build's file every time a test build runs, and vice versa. Each entry name is
  // deterministic and unique per mode, so there's nothing stale left behind to clean anyway.
  clean: false,
  sourcemap: isTestBuild,
  minify: !isTestBuild,
});
