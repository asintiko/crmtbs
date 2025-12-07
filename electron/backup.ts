import fs from 'node:fs'
import path from 'node:path'

export function createBackup(dbPath: string, documentsDir: string) {
  fs.mkdirSync(documentsDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const target = path.join(documentsDir, `inventory-${stamp}.db`)
  fs.copyFileSync(dbPath, target)
  return target
}
