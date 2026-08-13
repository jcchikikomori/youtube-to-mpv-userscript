import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
// Matches an actual import/require of child_process, not prose mentioning it in a comment
// (e.g. the invariant note documented at the top of MpvHandlerClient.ts).
const CHILD_PROCESS_IMPORT_RE = /(?:from\s+|require\(|import\()\s*['"](?:node:)?child_process['"]/;

function collectFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

describe('CHILD_PROCESS_IMPORT_RE', () => {
  it.each([
    "import { spawn } from 'child_process';",
    "import { spawn } from 'node:child_process';",
    "const cp = require('child_process');",
    "await import('node:child_process')",
  ])('matches a real import: %s', (line) => {
    expect(CHILD_PROCESS_IMPORT_RE.test(line)).toBe(true);
  });

  it('does not match prose mentioning child_process in a comment', () => {
    expect(CHILD_PROCESS_IMPORT_RE.test('// never import child_process here')).toBe(false);
  });
});

describe('no-child-process invariant', () => {
  it('nothing under src/ imports child_process — mpv launching stays inside mpv-handler.py', () => {
    const offenders = collectFiles(SRC_DIR).filter((file) =>
      CHILD_PROCESS_IMPORT_RE.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
