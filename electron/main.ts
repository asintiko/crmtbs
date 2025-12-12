import path from 'node:path'
import fs from 'node:fs'
import https from 'node:https'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import { createBackup } from './backup'
import { InventoryDatabase } from './database'
import type { BrowserWindow as ElectronWindow, Tray as ElectronTray, Event as ElectronEvent } from 'electron'

// ESM полифилл для __dirname, __filename и require
const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection in main process', reason)
})
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception in main process', error)
})

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

const isElectronRuntime = Boolean(process.versions?.electron)

// If running in plain Node (vite plugin runner), spawn Electron and exit current process.
if (!isElectronRuntime) {
  const electronEntry = require('electron') as unknown
  const electronPath =
    typeof electronEntry === 'string'
      ? electronEntry
      : typeof (electronEntry as { default?: string }).default === 'string'
        ? (electronEntry as { default: string }).default
        : ''

  if (!electronPath) {
    throw new Error('Не удалось найти путь до Electron')
  }

  const child = spawn(String(electronPath), [__filename], {
    stdio: 'inherit',
  })
  process.on('exit', () => child.kill())
  process.exit(0)
}

async function bootstrap() {
  const { app, BrowserWindow, ipcMain, Tray, Notification, nativeImage } = require('electron') as typeof import('electron')

  const getDbPath = () => path.join(app.getPath('userData'), 'inventory.db')
  const getBackupDir = () => path.join(app.getPath('documents'), 'InventoryBackups')

  let win: ElectronWindow | null
  let db: InventoryDatabase | null = null
  let tray: ElectronTray | null = null
  let reminderInterval: NodeJS.Timeout | null = null
  let quitting = false

  function createWindow() {
    win = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 1080,
      minHeight: 720,
      backgroundColor: '#0f172a',
      icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
      webPreferences: {
        preload: path.join(__dirname, 'preload.mjs'),
      },
    })

    if (VITE_DEV_SERVER_URL) {
      win.loadURL(VITE_DEV_SERVER_URL)
    } else {
      win.loadFile(path.join(RENDERER_DIST, 'index.html'))
    }

    win.on('close', (event: ElectronEvent) => {
      if (quitting) return
      event.preventDefault()
      win?.hide()
    })
  }

  function createTray() {
    const iconPath = path.join(process.env.VITE_PUBLIC ?? __dirname, 'electron-vite.svg')
    let icon = null
    try {
      if (fs.existsSync(iconPath)) {
        const candidate = nativeImage.createFromPath(iconPath)
        if (!candidate.isEmpty()) {
          icon = candidate
        }
      }
    } catch (error) {
      console.warn('Tray icon load failed, fallback to default', error)
    }

    try {
      tray = icon ? new Tray(icon) : new Tray(nativeImage.createEmpty())
    } catch (error) {
      console.warn('Tray creation skipped', error)
      tray = null
      return
    }

    tray.setToolTip('Inventory Desktop')
    tray.on('click', () => {
      if (win) {
        win.show()
        win.focus()
      } else {
        createWindow()
      }
    })
  }

  const checkReminders = () => {
    if (!db) return
    const reminders = db.listReminders().filter((r) => !r.done)
    const now = Date.now()
    for (const reminder of reminders) {
      if (new Date(reminder.dueAt).getTime() <= now) {
        const notif = new Notification({
          title: reminder.title,
          body: reminder.message ?? 'Напоминание',
        })
        notif.show()
        db.updateReminder({ id: reminder.id, done: true })
      }
    }
  }

  function startReminderLoop() {
    if (reminderInterval) clearInterval(reminderInterval)
    reminderInterval = setInterval(checkReminders, 60 * 1000)
    checkReminders()
  }

  async function checkForUpdates(): Promise<{
    hasUpdate: boolean
    currentVersion: string
    latestVersion?: string
    releaseUrl?: string
    releaseNotes?: string
    downloadUrl?: string
  }> {
    const currentVersion = app.getVersion()
    const GITHUB_REPO = 'asintiko/crmtbs'
    const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`

    return new Promise((resolve) => {
      https
        .get(
          GITHUB_API_URL,
          {
            headers: {
              'User-Agent': 'Inventory-Desktop',
              Accept: 'application/vnd.github.v3+json',
            },
          },
          (res) => {
            let data = ''

            res.on('data', (chunk) => {
              data += chunk
            })

            res.on('end', () => {
              try {
                if (res.statusCode !== 200) {
                  resolve({
                    hasUpdate: false,
                    currentVersion,
                  })
                  return
                }

                const release = JSON.parse(data)
                const latestVersion = release.tag_name?.replace(/^v/, '') || release.tag_name

                if (!latestVersion) {
                  resolve({
                    hasUpdate: false,
                    currentVersion,
                  })
                  return
                }

                // Простое сравнение версий (можно улучшить с помощью semver)
                const hasUpdate = latestVersion !== currentVersion

                // Найти URL для скачивания Windows установщика
                let downloadUrl: string | undefined
                const asset = release.assets?.find((a: { name: string }) =>
                  a.name.includes('Windows') && (a.name.endsWith('.exe') || a.name.endsWith('.Setup.exe') || a.name.includes('portable')),
                )
                if (asset) {
                  downloadUrl = asset.browser_download_url
                }

                resolve({
                  hasUpdate,
                  currentVersion,
                  latestVersion,
                  releaseUrl: release.html_url,
                  releaseNotes: release.body || undefined,
                  downloadUrl,
                })
              } catch (error) {
                console.error('Ошибка при парсинге ответа GitHub API:', error)
                resolve({
                  hasUpdate: false,
                  currentVersion,
                })
              }
            })
          },
        )
        .on('error', (error) => {
          console.error('Ошибка при проверке обновлений:', error)
          resolve({
            hasUpdate: false,
            currentVersion,
          })
        })
    })
  }

  function registerIpc() {
    if (!db) return

    // Auth
    ipcMain.handle('auth:login', (_event, payload) => db?.login(payload))
    ipcMain.handle('auth:logout', () => {})
    ipcMain.handle('auth:getCurrentUser', () => db?.listUsers()?.[0] ?? null)
    ipcMain.handle('auth:checkSession', (_event, token) => {
      const session = token ? db?.getSessionByToken(token) : null
      if (session && new Date(session.expiresAt) > new Date()) {
        return db?.getUserById(session.userId) ?? null
      }
      return db?.listUsers()?.[0] ?? null
    })

    // Users
    ipcMain.handle('users:list', () => db?.listUsers())
    ipcMain.handle('users:create', (_event, payload) => db?.createUser(payload))
    ipcMain.handle('users:update', (_event, payload) => db?.updateUser(payload))
    ipcMain.handle('users:delete', (_event, id) => db?.deleteUser(id))

    ipcMain.handle('products:list', () => db?.listProducts())
    ipcMain.handle('products:create', (_event, payload) => db?.createProduct(payload))
    ipcMain.handle('products:update', (_event, payload) => db?.updateProduct(payload))
    ipcMain.handle('products:delete', (_event, id) => db?.deleteProduct(id))

    ipcMain.handle('operations:list', () => db?.listOperations())
    ipcMain.handle('operations:create', (_event, payload) => db?.createOperation(payload))
    ipcMain.handle('operations:delete', (_event, id) => db?.deleteOperation(id))

    ipcMain.handle('dashboard:get', () => db?.getDashboard())
    ipcMain.handle('reservations:list', () => db?.listReservations())
    ipcMain.handle('reservations:update', (_event, payload) => db?.updateReservation(payload))
    ipcMain.handle('reminders:list', () => db?.listReminders())
    ipcMain.handle('reminders:create', (_event, payload) => db?.createReminder(payload))
    ipcMain.handle('reminders:update', (_event, payload) => db?.updateReminder(payload))

    // Full snapshot sync (local)
    ipcMain.handle('sync:pull', () => db?.exportSnapshot(true))
    ipcMain.handle('sync:push', (_event, snapshot) => {
      db?.importSnapshot(snapshot)
      return { success: true }
    })

    ipcMain.handle('sync:getGoogleDriveConfig', () => {
      const user = db?.listUsers()?.[0]
      if (!user) return null
      return db?.getUserGoogleDriveConfig(user.id)
    })
    ipcMain.handle('sync:saveGoogleDriveConfig', (_event, clientId: string, clientSecret: string) => {
      const user = db?.listUsers()?.[0]
      if (!db || !user) throw new Error('Пользователь не найден')
      db.updateUserGoogleDriveConfig(user.id, clientId, clientSecret)
      return { success: true }
    })

    ipcMain.handle('backup:manual', () => {
      if (!db) throw new Error('База данных не инициализирована')
      const backupPath = createBackup(db.getPath(), getBackupDir())
      return { backupPath }
    })

    ipcMain.handle('meta:paths', () => {
      if (!db) throw new Error('База данных не инициализирована')
      return {
        database: db.getPath(),
        backupsDir: getBackupDir(),
      }
    })

    ipcMain.handle('updates:check', async () => {
      return await checkForUpdates()
    })

    ipcMain.handle('updates:openUrl', async (_event, url: string) => {
      const { shell } = require('electron') as typeof import('electron')
      await shell.openExternal(url)
    })
  }

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
      win = null
    }
  })

  app.on('before-quit', () => {
    quitting = true
    if (db) {
      try {
        createBackup(db.getPath(), getBackupDir())
      } catch (error) {
        console.error('Ошибка при создании резервной копии', error)
      }
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  app.whenReady().then(() => {
    db = new InventoryDatabase(getDbPath())
    registerIpc()
    createTray()
    startReminderLoop()
    createWindow()
  })
}

bootstrap().catch((error) => {
  console.error('Main bootstrap failed', error)
})
