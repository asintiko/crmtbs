// Гибридный API: сервер + локальный fallback
import type { InventoryAPI } from '@/shared/ipc'
import type {
  ProductSummary,
  OperationWithProduct,
  Reservation,
  Reminder,
  User,
  SyncSnapshot,
} from '@/shared/types'
import { webApi } from './api-web'
import { 
  syncOnLogin, 
  syncChanges, 
  getLocalData, 
  clearLocalData,
  isServerAvailable,
  flushPendingChanges,
} from './syncService'

// Локальный кэш данных
let localCache: SyncSnapshot | null = null
let currentUser: User | null = null


// Пересчитать stock для продуктов на основе операций
function recalcProductStocks(products: ProductSummary[], operations: OperationWithProduct[]): ProductSummary[] {
  const stockMap: Record<number, { onHand: number; reserved: number; debt: number }> = {}
  
  for (const op of operations) {
    if (!stockMap[op.productId]) {
      stockMap[op.productId] = { onHand: 0, reserved: 0, debt: 0 }
    }
    const stock = stockMap[op.productId]
    
    switch (op.type) {
      case 'purchase':
      case 'return':
        stock.onHand += op.quantity
        break
      case 'sale':
      case 'sale_from_reserve':
      case 'ship_on_credit':
        stock.onHand -= op.quantity
        break
    }
    
    switch (op.type) {
      case 'reserve':
        stock.reserved += op.quantity
        break
      case 'reserve_release':
      case 'sale_from_reserve':
        stock.reserved -= op.quantity
        break
    }
    
    switch (op.type) {
      case 'ship_on_credit':
        stock.debt += op.quantity
        break
      case 'close_debt':
        stock.debt -= op.quantity
        break
    }
  }
  
  return products.map(p => ({
    ...p,
    stock: stockMap[p.id] 
      ? {
          onHand: stockMap[p.id].onHand,
          reserved: stockMap[p.id].reserved,
          debt: stockMap[p.id].debt,
          balance: stockMap[p.id].onHand,
          available: stockMap[p.id].onHand - stockMap[p.id].reserved,
        }
      : p.stock,
  }))
}

export const hybridApi: InventoryAPI = {
  // ===== AUTH =====
  login: async (payload) => {
    // Всегда через сервер
    const result = await webApi.login(payload)
    currentUser = result.user
    
    // Синхронизируем данные
    const syncData = await syncOnLogin(result.user)
    if (syncData) {
      localCache = syncData
    }
    
    return result
  },
  
  magicLogin: async (token) => {
    if (!webApi.magicLogin) throw new Error('Magic login не поддерживается')
    const result = await webApi.magicLogin(token)
    currentUser = result.user
    
    const syncData = await syncOnLogin(result.user)
    if (syncData) {
      localCache = syncData
    }
    
    return result
  },
  
  logout: async () => {
    await webApi.logout()
    currentUser = null
    localCache = null
    clearLocalData()
  },
  
  getCurrentUser: async () => {
    try {
      return await webApi.getCurrentUser()
    } catch {
      return currentUser
    }
  },
  
  checkSession: async (token) => {
    try {
      const user = await webApi.checkSession(token)
      if (user) {
        currentUser = user
        // Синхронизируем в фоне
        syncOnLogin(user).then(data => {
          if (data) localCache = data
        })
      }
      return user
    } catch {
      // Офлайн — возвращаем сохранённого пользователя
      return currentUser
    }
  },
  
  // ===== USERS =====
  listUsers: async () => {
    try {
      return await webApi.listUsers()
    } catch {
      return localCache?.users || []
    }
  },
  
  createUser: async (payload) => {
    return await webApi.createUser(payload)
  },
  
  updateUser: async (payload) => {
    return await webApi.updateUser(payload)
  },
  
  deleteUser: async (id) => {
    await webApi.deleteUser(id)
  },
  
  // ===== PRODUCTS =====
  listProducts: async () => {
    try {
      const online = await isServerAvailable()
      if (online) {
        const products = await webApi.listProducts()
        if (localCache) {
          localCache.products = products
        }
        return products
      }
    } catch {}
    
    // Офлайн
    return localCache?.products || []
  },
  
  createProduct: async (payload) => {
    const online = await isServerAvailable()
    if (online) {
      const product = await webApi.createProduct(payload)
      if (localCache) {
        localCache.products = [...localCache.products, product]
        void syncChanges(localCache)
      }
      return product
    }
    
    // Офлайн — создаём локально
    const tempId = -Date.now()
    const product: ProductSummary = {
      id: tempId,
      name: payload.name,
      sku: payload.sku || null,
      model: payload.model || null,
      minStock: payload.minStock || 0,
      hasImportPermit: payload.hasImportPermit || false,
      notes: payload.notes || null,
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aliases: [],
      stock: { onHand: 0, reserved: 0, debt: 0, balance: 0, available: 0 },
    }
    
    if (localCache) {
      localCache.products = [...localCache.products, product]
      void syncChanges(localCache)
    }
    
    return product
  },
  
  updateProduct: async (payload) => {
    const online = await isServerAvailable()
    if (online) {
      const product = await webApi.updateProduct(payload)
      if (localCache) {
        localCache.products = localCache.products.map(p => p.id === payload.id ? product : p)
        void syncChanges(localCache)
      }
      return product
    }
    
    // Офлайн
    if (localCache) {
      const existing = localCache.products.find(p => p.id === payload.id)
      if (existing) {
        const updated = { ...existing, ...payload, updatedAt: new Date().toISOString() } as ProductSummary
        localCache.products = localCache.products.map(p => p.id === payload.id ? updated : p)
        void syncChanges(localCache)
        return updated
      }
    }
    throw new Error('Товар не найден')
  },
  
  deleteProduct: async (id) => {
    const online = await isServerAvailable()
    if (online) {
      await webApi.deleteProduct(id)
    }
    
    if (localCache) {
      localCache.products = localCache.products.filter(p => p.id !== id)
      void syncChanges(localCache)
    }
  },
  
  // ===== OPERATIONS =====
  listOperations: async () => {
    try {
      const online = await isServerAvailable()
      if (online) {
        const operations = await webApi.listOperations()
        if (localCache) {
          localCache.operations = operations
        }
        return operations
      }
    } catch {}
    
    return localCache?.operations || []
  },
  
  createOperation: async (payload) => {
    const online = await isServerAvailable()
    if (online) {
      const operation = await webApi.createOperation(payload)
      if (localCache) {
        localCache.operations = [operation, ...localCache.operations]
        // Пересчитываем stocks
        localCache.products = recalcProductStocks(localCache.products, localCache.operations)
        void syncChanges(localCache)
      }
      return operation
    }
    
    // Офлайн
    const tempId = -Date.now()
    const product = localCache?.products.find(p => p.id === payload.productId)
    
    const operation: OperationWithProduct = {
      id: tempId,
      productId: payload.productId,
      type: payload.type,
      quantity: payload.quantity,
      customer: payload.customer || null,
      contact: payload.contact || null,
      permitNumber: payload.permitNumber || null,
      paid: payload.paid || false,
      reservationId: payload.reservationId || null,
      bundleId: payload.bundleId || null,
      dueAt: payload.dueAt || null,
      comment: payload.comment || null,
      occurredAt: payload.occurredAt || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      product: {
        id: payload.productId,
        name: product?.name || 'Товар',
        sku: product?.sku,
      },
      reservation: null,
      bundle: null,
    }
    
    if (localCache) {
      localCache.operations = [operation, ...localCache.operations]
      localCache.products = recalcProductStocks(localCache.products, localCache.operations)
      void syncChanges(localCache)
    }
    
    return operation
  },
  
  deleteOperation: async (id) => {
    const online = await isServerAvailable()
    if (online) {
      await webApi.deleteOperation(id)
    }
    
    if (localCache) {
      localCache.operations = localCache.operations.filter(o => o.id !== id)
      localCache.products = recalcProductStocks(localCache.products, localCache.operations)
      void syncChanges(localCache)
    }
  },
  
  // ===== DASHBOARD =====
  getDashboard: async () => {
    try {
      const online = await isServerAvailable()
      if (online) {
        return await webApi.getDashboard()
      }
    } catch {}
    
    // Офлайн — вычисляем локально
    if (!localCache) {
      return { lowStock: [], totalReserved: 0, activeDebts: [] }
    }
    
    const products = localCache.products
    const lowStock = products.filter(p => !p.archived && p.minStock > 0 && p.stock.available < p.minStock)
    const totalReserved = products.reduce((sum, p) => sum + p.stock.reserved, 0)
    
    return { lowStock, totalReserved, activeDebts: [] }
  },
  
  // ===== RESERVATIONS =====
  listReservations: async () => {
    try {
      const online = await isServerAvailable()
      if (online) {
        const reservations = await webApi.listReservations()
        if (localCache) localCache.reservations = reservations
        return reservations
      }
    } catch {}
    
    return localCache?.reservations || []
  },
  
  updateReservation: async (payload) => {
    const online = await isServerAvailable()
    if (online) {
      const updated = await webApi.updateReservation(payload)
      if (localCache) {
        localCache.reservations = localCache.reservations.map(r => r.id === payload.id ? updated : r)
        void syncChanges(localCache)
      }
      return updated
    }
    
    // Офлайн
    if (localCache) {
      const existing = localCache.reservations.find(r => r.id === payload.id)
      if (existing) {
        const updated = { ...existing, ...payload, updatedAt: new Date().toISOString() } as Reservation
        localCache.reservations = localCache.reservations.map(r => r.id === payload.id ? updated : r)
        void syncChanges(localCache)
        return updated
      }
    }
    throw new Error('Бронь не найдена')
  },
  
  // ===== REMINDERS =====
  listReminders: async () => {
    try {
      const online = await isServerAvailable()
      if (online) {
        const reminders = await webApi.listReminders()
        if (localCache) localCache.reminders = reminders
        return reminders
      }
    } catch {}
    
    return localCache?.reminders || []
  },
  
  createReminder: async (payload) => {
    const online = await isServerAvailable()
    if (online) {
      const reminder = await webApi.createReminder(payload)
      if (localCache) {
        localCache.reminders = [...localCache.reminders, reminder]
        void syncChanges(localCache)
      }
      return reminder
    }
    
    // Офлайн
    const tempId = -Date.now()
    const reminder: Reminder = {
      id: tempId,
      title: payload.title,
      message: payload.message || null,
      dueAt: payload.dueAt,
      done: false,
      targetType: payload.targetType || null,
      targetId: payload.targetId || null,
      createdAt: new Date().toISOString(),
    }
    
    if (localCache) {
      localCache.reminders = [...localCache.reminders, reminder]
      void syncChanges(localCache)
    }
    
    return reminder
  },
  
  updateReminder: async (payload) => {
    const online = await isServerAvailable()
    if (online) {
      const updated = await webApi.updateReminder(payload)
      if (localCache) {
        localCache.reminders = localCache.reminders.map(r => r.id === payload.id ? updated : r)
        void syncChanges(localCache)
      }
      return updated
    }
    
    // Офлайн
    if (localCache) {
      const existing = localCache.reminders.find(r => r.id === payload.id)
      if (existing) {
        const updated = { ...existing, ...payload } as Reminder
        localCache.reminders = localCache.reminders.map(r => r.id === payload.id ? updated : r)
        void syncChanges(localCache)
        return updated
      }
    }
    throw new Error('Напоминание не найдено')
  },
  
  // ===== BACKUP & META =====
  backupNow: async () => {
    return await webApi.backupNow()
  },
  
  getPaths: async () => {
    return await webApi.getPaths()
  },
  
  checkForUpdates: async () => {
    return await webApi.checkForUpdates()
  },
  
  openReleaseUrl: async (url) => {
    await webApi.openReleaseUrl(url)
  },
  
  // ===== SYNC =====
  saveGoogleDriveConfig: async (clientId, clientSecret) => {
    return await webApi.saveGoogleDriveConfig(clientId, clientSecret)
  },
  
  getGoogleDriveConfig: async () => {
    return await webApi.getGoogleDriveConfig()
  },
  
  getGoogleDriveAuthUrl: async (redirectUri) => {
    return await webApi.getGoogleDriveAuthUrl(redirectUri)
  },
  
  setGoogleDriveTokens: async (code, redirectUri) => {
    return await webApi.setGoogleDriveTokens(code, redirectUri)
  },
  
  startSync: async () => {
    // Отправить накопленные изменения
    const success = await flushPendingChanges()
    return { success, message: success ? 'Синхронизировано' : 'Нет подключения к серверу' }
  },
  
  syncPull: async () => {
    if (!webApi.syncPull) throw new Error('Sync not supported')
    const data = await webApi.syncPull()
    localCache = data
    return data
  },
  
  syncPush: async (snapshot) => {
    if (!webApi.syncPush) throw new Error('Sync not supported')
    const result = await webApi.syncPush(snapshot)
    return result
  },
}

// Инициализация при загрузке
export function initHybridApi() {
  // Загрузить локальные данные
  localCache = getLocalData()
  
  // Периодически пытаться отправить накопленные изменения
  setInterval(() => {
    void flushPendingChanges()
  }, 60000) // каждую минуту
}

