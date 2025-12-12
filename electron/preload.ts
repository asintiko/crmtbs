import { contextBridge, ipcRenderer } from 'electron'
import type { InventoryAPI } from '../src/shared/ipc'

const api: InventoryAPI = {
  // Auth
  login: (payload) => ipcRenderer.invoke('auth:login', payload),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
  checkSession: (token) => ipcRenderer.invoke('auth:checkSession', token),
  // Users
  listUsers: () => ipcRenderer.invoke('users:list'),
  createUser: (payload) => ipcRenderer.invoke('users:create', payload),
  updateUser: (payload) => ipcRenderer.invoke('users:update', payload),
  deleteUser: (id) => ipcRenderer.invoke('users:delete', id),
  listProducts: () => ipcRenderer.invoke('products:list'),
  createProduct: (payload) => ipcRenderer.invoke('products:create', payload),
  updateProduct: (payload) => ipcRenderer.invoke('products:update', payload),
  deleteProduct: (id) => ipcRenderer.invoke('products:delete', id),
  listOperations: () => ipcRenderer.invoke('operations:list'),
  createOperation: (payload) => ipcRenderer.invoke('operations:create', payload),
  deleteOperation: (id) => ipcRenderer.invoke('operations:delete', id),
  getDashboard: () => ipcRenderer.invoke('dashboard:get'),
  listReservations: () => ipcRenderer.invoke('reservations:list'),
  updateReservation: (payload) => ipcRenderer.invoke('reservations:update', payload),
  listReminders: () => ipcRenderer.invoke('reminders:list'),
  createReminder: (payload) => ipcRenderer.invoke('reminders:create', payload),
  updateReminder: (payload) => ipcRenderer.invoke('reminders:update', payload),
  backupNow: () => ipcRenderer.invoke('backup:manual'),
  getPaths: () => ipcRenderer.invoke('meta:paths'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  openReleaseUrl: (url: string) => ipcRenderer.invoke('updates:openUrl', url),
  saveGoogleDriveConfig: (clientId: string, clientSecret: string) =>
    ipcRenderer.invoke('sync:saveGoogleDriveConfig', clientId, clientSecret),
  getGoogleDriveConfig: () => ipcRenderer.invoke('sync:getGoogleDriveConfig'),
  getGoogleDriveAuthUrl: (redirectUri?: string) =>
    ipcRenderer.invoke('sync:getGoogleDriveAuthUrl', redirectUri),
  setGoogleDriveTokens: (code: string, redirectUri?: string) =>
    ipcRenderer.invoke('sync:setGoogleDriveTokens', code, redirectUri),
  startSync: () => ipcRenderer.invoke('sync:start'),
  syncPull: () => ipcRenderer.invoke('sync:pull'),
  syncPush: (snapshot) => ipcRenderer.invoke('sync:push', snapshot),
}

// --------- Expose app API to the Renderer process ---------
contextBridge.exposeInMainWorld('api', api)
