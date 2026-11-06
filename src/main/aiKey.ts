import { existsSync, readFileSync, rmSync } from 'node:fs'
import { safeStorage } from 'electron'
import { writeFileAtomic } from './jsonFile'

/**
 * The AI router key, encrypted with the system keyring (GNOME Keyring / KWallet) and kept out of
 * settings.json. It never goes back to the UI, which only learns whether one is saved.
 */
export class AiKeyStore {
  constructor(private readonly filePath: string) {}

  /** False when there's no keyring, in which case Hub won't store the key at all. */
  canStore(): Promise<boolean> {
    return safeStorage.isAsyncEncryptionAvailable()
  }

  has(): boolean {
    return existsSync(this.filePath)
  }

  async get(): Promise<string | undefined> {
    if (!this.has()) return undefined
    try {
      const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(
        readFileSync(this.filePath)
      )
      if (shouldReEncrypt) await this.set(result)
      return result
    } catch (err) {
      console.error('could not decrypt the AI key', err)
      return undefined
    }
  }

  async set(key: string): Promise<void> {
    if (!(await this.canStore())) throw new Error('no keyring')
    writeFileAtomic(this.filePath, await safeStorage.encryptStringAsync(key), 0o600)
  }

  clear(): void {
    rmSync(this.filePath, { force: true })
  }
}
