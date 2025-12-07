import { contextBridge, ipcRenderer } from 'electron'
import type { InventoryAPI } from '../src/shared/ipc'

const api: InventoryAPI = {
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
}

// --------- Expose app API to the Renderer process ---------
contextBridge.exposeInMainWorld('api', api)
