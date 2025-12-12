// Сервис синхронизации между локальной БД и сервером
import type { SyncSnapshot, User } from '@/shared/types'
import { webApi } from './api-web'

const SYNC_STORAGE_KEY = 'crm_local_data'

export interface LocalStorage {
  users: Record<number, SyncSnapshot>
  currentUserId: number | null
  lastSync: Record<number, string>
  pendingChanges: Record<number, SyncSnapshot | null>
}

// Получить локальные данные
function getLocalStorage(): LocalStorage {
  try {
    const data = localStorage.getItem(SYNC_STORAGE_KEY)
    if (data) {
      return JSON.parse(data)
    }
  } catch (e) {
    console.error('Ошибка чтения локального хранилища', e)
  }
  return {
    users: {},
    currentUserId: null,
    lastSync: {},
    pendingChanges: {},
  }
}

// Сохранить локальные данные
function setLocalStorage(data: LocalStorage) {
  try {
    localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('Ошибка записи в локальное хранилище', e)
  }
}

// Дефолтный сервер
const DEFAULT_SERVER = 'http://144.31.17.123:1122/api'
const API_BASE = import.meta.env.VITE_API_BASE || DEFAULT_SERVER

// Проверить доступность сервера
export async function isServerAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    
    const response = await fetch(
      API_BASE + '/auth/me',
      { 
        signal: controller.signal,
        headers: { 'Authorization': `Bearer ${localStorage.getItem('session_token') || ''}` }
      }
    )
    clearTimeout(timeout)
    return response.status !== 0 // Любой ответ = сервер доступен
  } catch {
    return false
  }
}

// Синхронизация при логине — скачать данные пользователя с сервера
export async function syncOnLogin(user: User): Promise<SyncSnapshot | null> {
  const storage = getLocalStorage()
  storage.currentUserId = user.id
  
  try {
    // Пробуем скачать данные с сервера
    const serverData = await webApi.syncPull?.()
    
    if (serverData) {
      // Сохраняем данные пользователя локально
      storage.users[user.id] = serverData
      storage.lastSync[user.id] = new Date().toISOString()
      storage.pendingChanges[user.id] = null
      setLocalStorage(storage)
      
      console.log('✅ Данные синхронизированы с сервером для пользователя', user.username)
      return serverData
    }
  } catch (error) {
    console.warn('⚠️ Не удалось синхронизировать с сервером, используем локальные данные', error)
  }
  
  // Возвращаем локальные данные если сервер недоступен
  const localData = storage.users[user.id]
  if (localData) {
    console.log('📦 Используем локальные данные для пользователя', user.username)
    return localData
  }
  
  setLocalStorage(storage)
  return null
}

// Сохранить изменения локально и попробовать отправить на сервер
export async function syncChanges(snapshot: SyncSnapshot): Promise<boolean> {
  const storage = getLocalStorage()
  const userId = storage.currentUserId
  
  if (!userId) {
    console.warn('Нет текущего пользователя для синхронизации')
    return false
  }
  
  // Сохраняем локально
  storage.users[userId] = snapshot
  storage.pendingChanges[userId] = snapshot
  setLocalStorage(storage)
  
  // Пробуем отправить на сервер
  try {
    const online = await isServerAvailable()
    if (online) {
      await webApi.syncPush?.(snapshot)
      
      // Успешно — убираем pending changes
      storage.pendingChanges[userId] = null
      storage.lastSync[userId] = new Date().toISOString()
      setLocalStorage(storage)
      
      console.log('✅ Изменения отправлены на сервер')
      return true
    } else {
      console.log('📦 Изменения сохранены локально (офлайн)')
      return false
    }
  } catch (error) {
    console.warn('⚠️ Не удалось отправить на сервер, сохранено локально', error)
    return false
  }
}

// Отправить накопленные изменения при восстановлении связи
export async function flushPendingChanges(): Promise<boolean> {
  const storage = getLocalStorage()
  const userId = storage.currentUserId
  
  if (!userId) return false
  
  const pending = storage.pendingChanges[userId]
  if (!pending) return true // Нет накопленных изменений
  
  try {
    const online = await isServerAvailable()
    if (!online) return false
    
    await webApi.syncPush?.(pending)
    
    storage.pendingChanges[userId] = null
    storage.lastSync[userId] = new Date().toISOString()
    setLocalStorage(storage)
    
    console.log('✅ Накопленные изменения отправлены на сервер')
    return true
  } catch (error) {
    console.warn('⚠️ Не удалось отправить накопленные изменения', error)
    return false
  }
}

// Получить локальные данные текущего пользователя
export function getLocalData(): SyncSnapshot | null {
  const storage = getLocalStorage()
  const userId = storage.currentUserId
  
  if (!userId) return null
  return storage.users[userId] || null
}

// Получить информацию о последней синхронизации
export function getLastSyncInfo(): { lastSync: string | null; hasPending: boolean } {
  const storage = getLocalStorage()
  const userId = storage.currentUserId
  
  if (!userId) {
    return { lastSync: null, hasPending: false }
  }
  
  return {
    lastSync: storage.lastSync[userId] || null,
    hasPending: storage.pendingChanges[userId] !== null,
  }
}

// Очистить данные при логауте
export function clearLocalData() {
  const storage = getLocalStorage()
  storage.currentUserId = null
  setLocalStorage(storage)
}

