import { mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/** Writes through a temp file and rename, so a crash mid-write can't truncate the file. */
export function writeFileAtomic(filePath: string, data: string | Buffer, mode = 0o644): void {
  mkdirSync(dirname(filePath), { recursive: true })
  const tmp = `${filePath}.tmp`
  writeFileSync(tmp, data, { mode })
  renameSync(tmp, filePath)
}

export function writeJsonAtomic(filePath: string, data: unknown): void {
  writeFileAtomic(filePath, JSON.stringify(data, null, 2))
}
