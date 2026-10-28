/** Channel names shared by main, preload and renderer. */
export const IPC = {
  appInfo: 'app:info'
} as const

export interface AppInfo {
  version: string
}

/** The API the preload exposes on `window.hub`. */
export interface HubApi {
  appInfo(): Promise<AppInfo>
}
