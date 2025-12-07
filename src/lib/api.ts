import type { InventoryAPI } from '../shared/ipc'
import type {
  NewProductPayload,
  OperationInput,
  OperationWithProduct,
  ProductSummary,
  Reservation,
  Reminder,
  StockSnapshot,
} from '../shared/types'
import { demoOperations, demoProducts } from './demoData'

let memoryProducts = [...demoProducts]
let memoryOperations = [...demoOperations]
let memoryReservations: Reservation[] = []
let memoryReminders: Reminder[] = []
let reminderIdCounter = 0
let aliasIdCounter = memoryProducts.reduce((max, p) => {
  const localMax = p.aliases.reduce((m, a) => Math.max(m, a.id), 0)
  return Math.max(max, localMax)
}, 0)

const recalcStocks = () => {
  const stockById: Record<number, StockSnapshot> = {}

  for (const op of memoryOperations) {
    const target = stockById[op.productId] ?? {
      onHand: 0,
      reserved: 0,
      debt: 0,
      balance: 0,
      available: 0,
    }

    switch (op.type) {
      case 'purchase':
      case 'return':
        target.onHand += op.quantity
        break
      case 'sale':
      case 'sale_from_reserve':
      case 'ship_on_credit':
        target.onHand -= op.quantity
        break
      default:
        break
    }

    switch (op.type) {
      case 'reserve':
        target.reserved += op.quantity
        break
      case 'reserve_release':
      case 'sale_from_reserve':
        target.reserved -= op.quantity
        break
      default:
        break
    }

    switch (op.type) {
      case 'ship_on_credit':
        target.debt += op.quantity
        break
      case 'close_debt':
        target.debt -= op.quantity
        break
      default:
        break
    }

    target.balance = target.onHand
    target.available = target.onHand - target.reserved

    stockById[op.productId] = target
  }

  memoryProducts = memoryProducts.map((p) => ({
    ...p,
    stock: stockById[p.id] ?? { onHand: 0, reserved: 0, debt: 0, balance: 0, available: 0 },
  }))
}

const fallbackApi: InventoryAPI = {
  listProducts: async () => memoryProducts,
  createProduct: async (payload: NewProductPayload) => {
    const now = new Date().toISOString()
    const id = Math.max(0, ...memoryProducts.map((p) => p.id)) + 1
    const aliases =
      payload.aliases?.filter(Boolean).map((label) => ({
        id: ++aliasIdCounter,
        productId: id,
        label: label.trim(),
      })) ?? []

    const created: ProductSummary = {
      id,
      name: payload.name,
      sku: payload.sku ?? null,
      model: payload.model ?? null,
      minStock: payload.minStock ?? 0,
      hasImportPermit: Boolean(payload.hasImportPermit),
      notes: payload.notes ?? null,
      archived: false,
      createdAt: now,
      updatedAt: now,
      aliases,
      accessories: [],
      stock: { onHand: 0, reserved: 0, debt: 0, balance: 0, available: 0 },
    }

    memoryProducts = [...memoryProducts, created]
    return created
  },
  updateProduct: async (payload) => {
    const existing = memoryProducts.find((p) => p.id === payload.id)
    if (!existing) throw new Error('Товар не найден')

    const aliases =
      payload.aliases?.map((label) => ({
        id: ++aliasIdCounter,
        productId: existing.id,
        label: label.trim(),
      })) ?? existing.aliases

    const updated: ProductSummary = {
      ...existing,
      name: payload.name ?? existing.name,
      sku: payload.sku === undefined ? existing.sku : payload.sku ?? null,
      model: payload.model === undefined ? existing.model : payload.model ?? null,
      minStock: payload.minStock ?? existing.minStock,
      hasImportPermit: payload.hasImportPermit ?? existing.hasImportPermit,
      notes: payload.notes === undefined ? existing.notes : payload.notes ?? null,
      archived: payload.archived ?? existing.archived,
      updatedAt: new Date().toISOString(),
      aliases,
    }

    memoryProducts = memoryProducts.map((p) => (p.id === updated.id ? updated : p))
    return updated
  },
  deleteProduct: async (id: number) => {
    const hasOperations = memoryOperations.some((op) => op.productId === id)
    if (hasOperations) {
      throw new Error('Товар используется в операциях и не может быть удален')
    }
    memoryOperations = memoryOperations.filter((op) => op.productId !== id)
    memoryProducts = memoryProducts.filter((p) => p.id !== id)
    recalcStocks()
  },
  listOperations: async () => memoryOperations,
  createOperation: async (payload: OperationInput) => {
    if (payload.quantity <= 0) {
      throw new Error('Количество должно быть больше 0')
    }

    const customer = payload.customer?.trim() ?? ''
    const contact = payload.contact?.trim() ?? ''

    if (['ship_on_credit', 'close_debt'].includes(payload.type) && !customer) {
      throw new Error('Укажите клиента для операций с долгом')
    }

    if (payload.type === 'close_debt') {
      const currentDebt = memoryOperations.reduce((acc, op) => {
        if (op.productId !== payload.productId) return acc
        if ((op.customer ?? '').trim().toLowerCase() !== customer.toLowerCase()) return acc
        if (op.type === 'ship_on_credit') return acc + op.quantity
        if (op.type === 'close_debt') return acc - op.quantity
        return acc
      }, 0)

      if (currentDebt <= 0) {
        throw new Error('Долг для этого клиента отсутствует')
      }
      if (payload.quantity > currentDebt) {
        throw new Error('Сумма погашения превышает остаток долга')
      }
    }

    const now = payload.occurredAt ?? new Date().toISOString()
    const id = Math.max(0, ...memoryOperations.map((op) => op.id)) + 1
    const product = memoryProducts.find((p) => p.id === payload.productId)

    let reservationId = payload.reservationId ?? null
    if (payload.type === 'reserve') {
      const resId = Math.max(0, ...memoryReservations.map((r) => r.id)) + 1
      const linkCode = `BR-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`
      const reservation: Reservation = {
        id: resId,
        productId: payload.productId,
        quantity: payload.quantity,
        customer: customer || undefined,
        contact: contact || undefined,
        status: 'active',
        dueAt: payload.dueAt ?? undefined,
        comment: payload.comment ?? undefined,
        linkCode,
        createdAt: now,
        updatedAt: now,
        product: {
          id: payload.productId,
          name: product?.name ?? 'Товар',
          sku: product?.sku ?? undefined,
        },
      }
      memoryReservations = [reservation, ...memoryReservations]
      reservationId = resId
    }

    if (['reserve_release', 'sale_from_reserve'].includes(payload.type)) {
      if (!reservationId) {
        throw new Error('Укажите бронь')
      }
      memoryReservations = memoryReservations.map((res) =>
        res.id === reservationId
          ? { ...res, status: payload.type === 'sale_from_reserve' ? 'sold' : 'released', updatedAt: now }
          : res,
      )
    }

    const paid =
      payload.paid ??
      (['sale', 'sale_from_reserve', 'close_debt'].includes(payload.type)
        ? true
        : payload.type === 'ship_on_credit'
          ? false
          : false)

    const created: OperationWithProduct = {
      id,
      productId: payload.productId,
      type: payload.type,
      quantity: payload.quantity,
      customer: customer || null,
      contact: contact || null,
      permitNumber: payload.permitNumber ?? null,
      paid,
      reservationId,
      bundleId: payload.bundleId ?? null,
      dueAt: payload.dueAt ?? null,
      comment: payload.comment ?? null,
      occurredAt: now,
      createdAt: now,
      product: {
        id: product?.id ?? payload.productId,
        name: product?.name ?? 'Товар',
        sku: product?.sku ?? undefined,
      },
      reservation: reservationId
        ? memoryReservations.find((r) => r.id === reservationId) ?? undefined
        : undefined,
      bundle: null,
    }

    memoryOperations = [created, ...memoryOperations]
    recalcStocks()
    return created
  },
  deleteOperation: async (id: number) => {
    memoryOperations = memoryOperations.filter((op) => op.id !== id)
    recalcStocks()
  },
  getDashboard: async () => ({
    lowStock: memoryProducts.filter((p) => p.stock.available < p.minStock && !p.archived),
    totalReserved: memoryProducts.reduce((acc, p) => acc + p.stock.reserved, 0),
    activeDebts: Array.from(
      memoryOperations.reduce<Map<string, { productId: number; customer: string; debt: number }>>(
        (acc, op) => {
          if (!op.customer) return acc
          const delta =
            op.type === 'ship_on_credit' ? op.quantity : op.type === 'close_debt' ? -op.quantity : 0
          if (!delta) return acc
          const key = `${op.productId}-${op.customer}`
          const existing = acc.get(key) ?? { productId: op.productId, customer: op.customer, debt: 0 }
          existing.debt += delta
          acc.set(key, existing)
          return acc
        },
        new Map(),
      ),
    )
      .map(([, item]) => item)
      .filter((item) => item.debt > 0)
      .map((item) => ({
        ...item,
        productName: memoryProducts.find((p) => p.id === item.productId)?.name ?? 'Товар',
      })),
  }),
  listReservations: async () => memoryReservations,
  updateReservation: async (payload) => {
    const index = memoryReservations.findIndex((r) => r.id === payload.id)
    if (index === -1) throw new Error('Бронь не найдена')
    const updated: Reservation = {
      ...memoryReservations[index],
      customer: payload.customer ?? memoryReservations[index].customer,
      contact: payload.contact ?? memoryReservations[index].contact,
      status: payload.status ?? memoryReservations[index].status,
      dueAt: payload.dueAt ?? memoryReservations[index].dueAt,
      comment: payload.comment ?? memoryReservations[index].comment,
      updatedAt: new Date().toISOString(),
    }
    memoryReservations[index] = updated
    return updated
  },
  listReminders: async () => memoryReminders,
  createReminder: async (payload) => {
    const now = new Date().toISOString()
    const reminder: Reminder = {
      id: ++reminderIdCounter,
      title: payload.title,
      message: payload.message ?? null,
      dueAt: payload.dueAt,
      done: false,
      targetType: payload.targetType ?? null,
      targetId: payload.targetId ?? null,
      createdAt: now,
    }
    memoryReminders = [...memoryReminders, reminder]
    return reminder
  },
  updateReminder: async (payload) => {
    const idx = memoryReminders.findIndex((r) => r.id === payload.id)
    if (idx === -1) throw new Error('Напоминание не найдено')
    const next: Reminder = {
      ...memoryReminders[idx],
      title: payload.title ?? memoryReminders[idx].title,
      message: payload.message ?? memoryReminders[idx].message,
      dueAt: payload.dueAt ?? memoryReminders[idx].dueAt,
      done: payload.done ?? memoryReminders[idx].done,
      targetType: payload.targetType ?? memoryReminders[idx].targetType,
      targetId: payload.targetId ?? memoryReminders[idx].targetId,
    }
    memoryReminders[idx] = next
    return next
  },
  backupNow: async () => ({ backupPath: 'demo-backup/inventory.db' }),
  getPaths: async () => ({
    database: 'demo-db/inventory.db',
    backupsDir: 'demo-backups',
  }),
  checkForUpdates: async () => ({
    hasUpdate: false,
    currentVersion: '0.1.0',
  }),
  openReleaseUrl: async () => {},
}

export const api: InventoryAPI = window.api ?? fallbackApi
export const hasNativeApi = Boolean(window.api)
