export type Platform = 'linux' | 'mac' | 'windows' | 'unknown';

/** Pure — takes navigator.platform as a parameter rather than reading the global, for testability. */
export function getPlatform(platformString: string): Platform {
  const normalized = platformString.toLowerCase();
  if (normalized.includes('linux')) return 'linux';
  if (normalized.includes('mac')) return 'mac';
  if (normalized.includes('win')) return 'windows';
  return 'unknown';
}
