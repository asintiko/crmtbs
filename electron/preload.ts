import { contextBridge, ipcRenderer } from 'electron'
import type { InventoryAPI } from '../src/shared/ipc'

const SESSION_TOKEN_KEY = 'session_token'

// Helper функция для получения токена
// В preload скрипте localStorage доступен через window.localStorage
// так как preload выполняется в контексте renderer процесса
function getToken(): string | null {
  try {
    // В Electron preload скрипт имеет доступ к window и localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      const token = window.localStorage.getItem(SESSION_TOKEN_KEY)
      return token
    }
  } catch (error) {
    // Если localStorage недоступен, логируем и возвращаем null
    console.warn('Не удалось получить токен из localStorage в preload:', error)
  }
  return null
}

const api: InventoryAPI = {
  // Auth
  login: (payload) => ipcRenderer.invoke('auth:login', payload),
  logout: async () => {
    const token = getToken()
    await ipcRenderer.invoke('auth:logout', token)
    try {
      localStorage.removeItem(SESSION_TOKEN_KEY)
    } catch {}
  },
  getCurrentUser: () => {
    const token = getToken()
    return ipcRenderer.invoke('auth:getCurrentUser', token)
  },
  checkSession: (token) => ipcRenderer.invoke('auth:checkSession', token),
  refreshSession: (token) => ipcRenderer.invoke('auth:refreshSession', token),
  // Users
  listUsers: () => {
    const token = getToken()
    return ipcRenderer.invoke('users:list', token)
  },
  createUser: (payload) => {
    const token = getToken()
    return ipcRenderer.invoke('users:create', payload, token)
  },
  updateUser: (payload) => {
    const token = getToken()
    return ipcRenderer.invoke('users:update', payload, token)
  },
  deleteUser: (id) => {
    const token = getToken()
    return ipcRenderer.invoke('users:delete', id, token)
  },
  listProducts: () => {
    const token = getToken()
    // #region agent log
    if (!token) console.warn('⚠️ No token available for listProducts')
    // #endregion
    return ipcRenderer.invoke('products:list', token)
  },
  createProduct: (payload) => {
    const token = getToken()
    return ipcRenderer.invoke('products:create', payload, token)
  },
  updateProduct: (payload) => {
    const token = getToken()
    return ipcRenderer.invoke('products:update', payload, token)
  },
  deleteProduct: (id) => {
    const token = getToken()
    return ipcRenderer.invoke('products:delete', id, token)
  },
  listOperations: () => {
    const token = getToken()
    return ipcRenderer.invoke('operations:list', token)
  },
  createOperation: (payload) => {
    const token = getToken()
    return ipcRenderer.invoke('operations:create', payload, token)
  },
  deleteOperation: (id) => {
    const token = getToken()
    return ipcRenderer.invoke('operations:delete', id, token)
  },
  getDashboard: () => {
    const token = getToken()
    return ipcRenderer.invoke('dashboard:get', token)
  },
  listReservations: () => {
    const token = getToken()
    return ipcRenderer.invoke('reservations:list', token)
  },
  updateReservation: (payload) => {
    const token = getToken()
    return ipcRenderer.invoke('reservations:update', payload, token)
  },
  listReminders: () => {
    const token = getToken()
    return ipcRenderer.invoke('reminders:list', token)
  },
  createReminder: (payload) => {
    const token = getToken()
    return ipcRenderer.invoke('reminders:create', payload, token)
  },
  updateReminder: (payload) => {
    const token = getToken()
    return ipcRenderer.invoke('reminders:update', payload, token)
  },
  backupNow: () => ipcRenderer.invoke('backup:manual'),
  getPaths: () => ipcRenderer.invoke('meta:paths'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  openReleaseUrl: (url: string) => ipcRenderer.invoke('updates:openUrl', url),
  saveGoogleDriveConfig: (clientId: string, clientSecret: string) => {
    const token = getToken()
    return ipcRenderer.invoke('sync:saveGoogleDriveConfig', clientId, clientSecret, token)
  },
  getGoogleDriveConfig: () => {
    const token = getToken()
    return ipcRenderer.invoke('sync:getGoogleDriveConfig', token)
  },
  getGoogleDriveAuthUrl: (redirectUri?: string) =>
    ipcRenderer.invoke('sync:getGoogleDriveAuthUrl', redirectUri),
  setGoogleDriveTokens: (code: string, redirectUri?: string) =>
    ipcRenderer.invoke('sync:setGoogleDriveTokens', code, redirectUri),
  startSync: () => ipcRenderer.invoke('sync:start'),
  syncPull: () => {
    const token = getToken()
    return ipcRenderer.invoke('sync:pull', token)
  },
  syncPush: (snapshot) => {
    const token = getToken()
    return ipcRenderer.invoke('sync:push', snapshot, token)
  },
}

// --------- Expose app API to the Renderer process ---------
contextBridge.exposeInMainWorld('api', api)
