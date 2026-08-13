export interface UserscriptConfig {
  mpvPath: string;
  showButton: boolean;
  autoPlaylist: boolean;
  enableNativeMenuItems: boolean;
}

const DEFAULT_CONFIG: UserscriptConfig = {
  mpvPath: 'mpv',
  showButton: true,
  autoPlaylist: false,
  enableNativeMenuItems: true,
};

export function getConfig<K extends keyof UserscriptConfig>(key: K): UserscriptConfig[K] {
  return GM_getValue(key, DEFAULT_CONFIG[key]);
}

export function setConfig<K extends keyof UserscriptConfig>(
  key: K,
  value: UserscriptConfig[K],
): void {
  GM_setValue(key, value);
}
