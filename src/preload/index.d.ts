import type { HubApi, WriterApi } from '../shared/ipc'

declare global {
  interface Window {
    hub: HubApi
    /** Only in the writing panel's page. */
    writer: WriterApi
  }
}
