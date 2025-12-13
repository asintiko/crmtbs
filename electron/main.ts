import path from 'node:path'
import fs from 'node:fs'
import https from 'node:https'
import http from 'node:http'
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
  const { app, BrowserWindow, ipcMain, Tray, Notification, nativeImage, Menu } = require('electron') as typeof import('electron')

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
      icon: path.join(process.env.VITE_PUBLIC, 'logo1.png'),
      webPreferences: {
        preload: path.join(__dirname, 'preload.mjs'),
      },
      autoHideMenuBar: true,
    })

    Menu.setApplicationMenu(null)
    win.setMenuBarVisibility(false)
    win.removeMenu()

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
    const iconPath = path.join(process.env.VITE_PUBLIC ?? __dirname, 'logo1.png')
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
    // Проверяем напоминания для всех пользователей
    const users = db.listUsers()
    for (const user of users) {
      const reminders = db.listReminders(user.id).filter((r) => !r.done)
      const now = Date.now()
      for (const reminder of reminders) {
        if (new Date(reminder.dueAt).getTime() <= now) {
          const notif = new Notification({
            title: reminder.title,
            body: reminder.message ?? 'Напоминание',
          })
          notif.show()
          db.updateReminder({ id: reminder.id, done: true }, user.id)
          // #region agent log
          logDebug('electron/main.ts:checkReminders', 'Reminder notification shown', { userId: user.id, reminderId: reminder.id }, 'C')
          // #endregion
        }
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

  // Helper функция для логирования (использует Node.js http)
  function logDebug(location: string, message: string, data: any, hypothesisId: string = 'A') {
    try {
      const logData = JSON.stringify({
        location,
        message,
        data,
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'multi-user',
        hypothesisId,
      })
      const url = new URL('http://127.0.0.1:7242/ingest/d0d7972b-8c29-47b4-9fc7-6bb593f6abb2')
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(logData),
        },
      }
      const req = http.request(options, () => {})
      req.on('error', () => {}) // Игнорируем ошибки логирования
      req.write(logData)
      req.end()
    } catch (error) {
      // Игнорируем ошибки логирования
    }
  }

  // Helper функция для получения userId из токена сессии
  function getUserIdFromToken(token: string | null | undefined): number | null {
    if (!db || !token) {
      // #region agent log
      logDebug('electron/main.ts:getUserIdFromToken', 'Token is null or db is null', { hasToken: !!token, hasDb: !!db }, 'A')
      // #endregion
      return null
    }
    try {
      const session = db.getSessionByToken(token)
      if (session && new Date(session.expiresAt) > new Date()) {
        // #region agent log
        logDebug('electron/main.ts:getUserIdFromToken', 'User ID resolved from token', { token: token.substring(0, 8) + '...', userId: session.userId }, 'A')
        // #endregion
        return session.userId
      } else {
        // #region agent log
        logDebug('electron/main.ts:getUserIdFromToken', 'Session invalid or expired', { hasSession: !!session, expired: session ? new Date(session.expiresAt) < new Date() : false }, 'A')
        // #endregion
      }
    } catch (error) {
      console.error('Ошибка при получении userId из токена:', error)
      // #region agent log
      logDebug('electron/main.ts:getUserIdFromToken', 'Error getting userId', { error: error instanceof Error ? error.message : String(error) }, 'A')
      // #endregion
    }
    return null
  }

  function registerIpc() {
    if (!db) return

    // Auth
    ipcMain.handle('auth:login', (_event, payload) => {
      try {
        // Получаем IP и User-Agent из события (если доступны)
        const ipAddress = _event.sender.getURL() || undefined
        const userAgent = _event.sender.getUserAgent() || undefined
        const result = db?.login(payload, ipAddress, userAgent)
        // #region agent log
        if (result) logDebug('electron/main.ts:auth:login', 'User logged in', { userId: result.user.id, username: result.user.username }, 'A')
        // #endregion
        return result
      } catch (error) {
        // #region agent log
        logDebug('electron/main.ts:auth:login', 'Login failed', { error: error instanceof Error ? error.message : String(error) }, 'A')
        // #endregion
        throw error
      }
    })
    ipcMain.handle('auth:logout', (_event, token) => {
      if (token && db) {
        const session = db.getSessionByToken(token)
        if (session) {
          // Логируем выход
          db.logAuditEvent(session.userId, 'logout', 'user', session.userId, null)
        }
        db.deleteSession(token)
        // #region agent log
        logDebug('electron/main.ts:auth:logout', 'User logged out', { token: token.substring(0, 8) + '...' }, 'A')
        // #endregion
      }
    })
    ipcMain.handle('auth:getCurrentUser', (_event, token) => {
      const userId = getUserIdFromToken(token)
      if (userId) {
        const user = db?.getUserById(userId)
        // #region agent log
        if (user) logDebug('electron/main.ts:auth:getCurrentUser', 'Current user retrieved', { userId: user.id, username: user.username }, 'A')
        // #endregion
        return user ?? null
      }
      // #region agent log
      logDebug('electron/main.ts:auth:getCurrentUser', 'No user found', { hasToken: !!token }, 'A')
      // #endregion
      return null
    })

    // Обновление токена сессии
    ipcMain.handle('auth:refreshSession', (_event, token) => {
      if (!db || !token) return null
      try {
        const refreshed = db.refreshSession(token, 30)
        // #region agent log
        if (refreshed) logDebug('electron/main.ts:auth:refreshSession', 'Session refreshed', { userId: refreshed.userId }, 'A')
        // #endregion
        return refreshed
      } catch (error) {
        console.error('Ошибка при обновлении сессии:', error)
        return null
      }
    })
    ipcMain.handle('auth:checkSession', (_event, token) => {
      const userId = getUserIdFromToken(token)
      if (userId) {
        const user = db?.getUserById(userId)
        // #region agent log
        if (user) logDebug('electron/main.ts:auth:checkSession', 'Session checked', { userId: user.id, username: user.username }, 'A')
        // #endregion
        return user ?? null
      }
      // #region agent log
      logDebug('electron/main.ts:auth:checkSession', 'Session invalid', { hasToken: !!token }, 'A')
      // #endregion
      return null
    })

    // Users (admin only - проверяем права)
    ipcMain.handle('users:list', (_event, token) => {
      const userId = getUserIdFromToken(token)
      if (!userId) throw new Error('Не авторизован')
      const user = db?.getUserById(userId)
      if (!user || user.role !== 'admin') throw new Error('Доступ запрещен')
      return db?.listUsers()
    })
    ipcMain.handle('users:create', (_event, payload, token) => {
      const userId = getUserIdFromToken(token)
      if (!userId) throw new Error('Не авторизован')
      const user = db?.getUserById(userId)
      if (!user || user.role !== 'admin') throw new Error('Доступ запрещен')
      return db?.createUser(payload)
    })
    ipcMain.handle('users:update', (_event, payload, token) => {
      const userId = getUserIdFromToken(token)
      if (!userId) throw new Error('Не авторизован')
      const user = db?.getUserById(userId)
      if (!user || user.role !== 'admin') throw new Error('Доступ запрещен')
      return db?.updateUser(payload)
    })
    ipcMain.handle('users:delete', (_event, id, token) => {
      const userId = getUserIdFromToken(token)
      if (!userId) throw new Error('Не авторизован')
      const user = db?.getUserById(userId)
      if (!user || user.role !== 'admin') throw new Error('Доступ запрещен')
      db?.deleteUser(id)
    })

    // Products - с проверкой userId
    ipcMain.handle('products:list', (_event, token) => {
      const userId = getUserIdFromToken(token)
      if (!userId) {
        // #region agent log
        logDebug('electron/main.ts:products:list', 'Unauthorized access attempt', { hasToken: !!token, tokenLength: token?.length }, 'B')
        // #endregion
        throw new Error('Не авторизован')
      }
      // #region agent log
      logDebug('electron/main.ts:products:list', 'Listing products for user', { userId }, 'B')
      // #endregion
      return db?.listProducts(userId)
    })
    ipcMain.handle('products:create', (_event, payload, token) => {
      const userId = getUserIdFromToken(token)
      if (!userId) throw new Error('Не авторизован')
      // #region agent log
      logDebug('electron/main.ts:products:create', 'Creating product for user', { userId, productName: payload.name }, 'B')
      // #endregion
      return db?.createProduct(payload, userId)
    })
    ipcMain.handle('products:update', (_event, payload, token) => {
      const userId = getUserIdFromToken(token)
      if (!userId) throw new Error('Не авторизован')
      // #region agent log
      logDebug('electron/main.ts:products:update', 'Updating product for user', { userId, productId: payload.id }, 'B')
      // #endregion
      return db?.updateProduct(payload, userId)
    })
    ipcMain.handle('products:delete', (_event, id, token) => {
      const userId = getUserIdFromToken(token)
      if (!userId) throw new Error('Не авторизован')
      // #region agent log
      logDebug('electron/main.ts:products:delete', 'Deleting product for user', { userId, productId: id }, 'B')
      // #endregion
      db?.deleteProduct(id, userId)
    })

    // Operations - с проверкой userId
    ipcMain.handle('operations:list', (_event, token) => {
      const userId = getUserIdFromToken(token)
      if (!userId) {
        logDebug('electron/main.ts:operations:list', 'Unauthorized access attempt', { hasToken: !!token }, 'B')
        throw new Error('Не авторизован')
      }
      return db?.listOperations(userId)
    })
    ipcMain.handle('operations:create', (_event, payload, token) => {
      const userId = getUserIdFromToken(token)
      if (!userId) {
        logDebug('electron/main.ts:operations:create', 'Unauthorized access attempt', { hasToken: !!token }, 'B')
        throw new Error('Не авторизован')
      }
      // #region agent log
      logDebug('electron/main.ts:operations:create', 'Creating operation for user', { userId, operationType: payload.type, productId: payload.productId }, 'B')
      // #endregion
      return db?.createOperation(payload, userId)
    })
    ipcMain.handle('operations:delete', (_event, id, token) => {
      const userId = getUserIdFromToken(token)
      if (!userId) {
        logDebug('electron/main.ts:operations:delete', 'Unauthorized access attempt', { hasToken: !!token }, 'B')
        throw new Error('Не авторизован')
      }
      db?.deleteOperation(id, userId)
    })

    // Dashboard - с проверкой userId
    ipcMain.handle('dashboard:get', (_event, token) => {
      const userId = getUserIdFromToken(token)
      if (!userId) throw new Error('Не авторизован')
      return db?.getDashboard(userId)
    })
    
    // Reservations - с проверкой userId
    ipcMain.handle('reservations:list', (_event, token) => {
      const userId = getUserIdFromToken(token)
      if (!userId) throw new Error('Не авторизован')
      return db?.listReservations(userId)
    })
    ipcMain.handle('reservations:update', (_event, payload, token) => {
      const userId = getUserIdFromToken(token)
      if (!userId) throw new Error('Не авторизован')
      return db?.updateReservation(payload, userId)
    })
    
    // Reminders - с проверкой userId
    ipcMain.handle('reminders:list', (_event, token) => {
      const userId = getUserIdFromToken(token)
      if (!userId) throw new Error('Не авторизован')
      return db?.listReminders(userId)
    })
    ipcMain.handle('reminders:create', (_event, payload, token) => {
      const userId = getUserIdFromToken(token)
      if (!userId) throw new Error('Не авторизован')
      return db?.createReminder(payload, userId)
    })
    ipcMain.handle('reminders:update', (_event, payload, token) => {
      const userId = getUserIdFromToken(token)
      if (!userId) throw new Error('Не авторизован')
      return db?.updateReminder(payload, userId)
    })

    // Full snapshot sync (local) - с проверкой userId
    ipcMain.handle('sync:pull', (_event, token) => {
      const userId = getUserIdFromToken(token)
      if (!userId) throw new Error('Не авторизован')
      return db?.exportSnapshot(true, userId)
    })
    ipcMain.handle('sync:push', (_event, snapshot, token) => {
      const userId = getUserIdFromToken(token)
      if (!userId) throw new Error('Не авторизован')
      db?.importSnapshot(snapshot, userId)
      return { success: true }
    })

    ipcMain.handle('sync:getGoogleDriveConfig', (_event, token) => {
      const userId = getUserIdFromToken(token)
      if (!userId) throw new Error('Не авторизован')
      return db?.getUserGoogleDriveConfig(userId)
    })
    ipcMain.handle('sync:saveGoogleDriveConfig', (_event, clientId: string, clientSecret: string, token) => {
      const userId = getUserIdFromToken(token)
      if (!userId) throw new Error('Не авторизован')
      if (!db) throw new Error('База данных не инициализирована')
      db.updateUserGoogleDriveConfig(userId, clientId, clientSecret)
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
