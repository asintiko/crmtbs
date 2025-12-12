import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { api, hasNativeApi } from '@/lib/api'
import type {
  DashboardSummary,
  NewProductPayload,
  OperationInput,
  OperationWithProduct,
  ProductSummary,
  Reservation,
  Reminder,
  UpdateProductPayload,
} from '@shared/types'
import { useAuth } from './AuthProvider'

type InventoryContextValue = {
  products: ProductSummary[]
  operations: OperationWithProduct[]
  reservations: Reservation[]
  reminders: Reminder[]
  dashboard: DashboardSummary | null
  loading: boolean
  refresh: () => Promise<void>
  createProduct: (payload: NewProductPayload) => Promise<ProductSummary | null>
  updateProduct: (payload: UpdateProductPayload) => Promise<ProductSummary | null>
  deleteProduct: (id: number) => Promise<void>
  createOperation: (payload: OperationInput) => Promise<OperationWithProduct>
  deleteOperation: (id: number) => Promise<void>
  updateReservation: (payload: Partial<Reservation> & { id: number }) => Promise<Reservation | null>
  createReminder: (
    payload: Omit<Reminder, 'id' | 'done' | 'createdAt'>,
  ) => Promise<Reminder | null>
  updateReminder: (payload: Partial<Reminder> & { id: number }) => Promise<Reminder | null>
  isDemo: boolean
}

const InventoryContext = createContext<InventoryContextValue | undefined>(undefined)

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, magicLogin, loading: authLoading } = useAuth()
  const [products, setProducts] = useState<ProductSummary[]>([])
  const [operations, setOperations] = useState<OperationWithProduct[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  
  // Используем ref для isAuthenticated чтобы избежать пересоздания refresh
  const isAuthenticatedRef = useRef(isAuthenticated)
  isAuthenticatedRef.current = isAuthenticated

  const refresh = useCallback(async () => {
    // Для веб-версии требуется авторизация
    if (!hasNativeApi && !isAuthenticatedRef.current) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [items, ops, dash, res, rem] = await Promise.all([
        api.listProducts(),
        api.listOperations(),
        api.getDashboard(),
        api.listReservations ? api.listReservations() : Promise.resolve([]),
        api.listReminders ? api.listReminders() : Promise.resolve([]),
      ])
      setProducts(items)
      setOperations(ops)
      setDashboard(dash)
      setReservations(res)
      setReminders(rem)
    } catch (error) {
      console.error('Не удалось загрузить данные', error)
    } finally {
      setLoading(false)
    }
  }, []) // Убрали зависимости чтобы предотвратить пересоздание

  const createProduct = useCallback(
    async (payload: NewProductPayload) => {
      try {
        const created = await api.createProduct(payload)
        await refresh()
        return created
      } catch (error) {
        console.error('Не удалось создать товар', error)
        return null
      }
    },
    [refresh],
  )

  const updateProduct = useCallback(
    async (payload: UpdateProductPayload) => {
      try {
        const updated = await api.updateProduct(payload)
        await refresh()
        return updated
      } catch (error) {
        console.error('Не удалось обновить товар', error)
        return null
      }
    },
    [refresh],
  )

  const deleteProduct = useCallback(
    async (id: number) => {
      try {
        await api.deleteProduct(id)
        await refresh()
      } catch (error) {
        console.error('Не удалось удалить товар', error)
        throw error
      }
    },
    [refresh],
  )

  const createOperation = useCallback(
    async (payload: OperationInput) => {
      try {
        const created = await api.createOperation(payload)
        await refresh()
        return created
      } catch (error) {
        console.error('Не удалось создать операцию', error)
        throw error
      }
    },
    [refresh],
  )

  const deleteOperation = useCallback(
    async (id: number) => {
      try {
        await api.deleteOperation(id)
        await refresh()
      } catch (error) {
        console.error('Не удалось удалить операцию', error)
        throw error
      }
    },
    [refresh],
  )

  const updateReservation = useCallback(
    async (payload: Partial<Reservation> & { id: number }) => {
      if (!api.updateReservation) return null
      try {
        const updated = await api.updateReservation(payload)
        await refresh()
        return updated
      } catch (error) {
        console.error('Не удалось обновить бронь', error)
        return null
      }
    },
    [refresh],
  )

  const createReminder = useCallback(
    async (payload: Omit<Reminder, 'id' | 'done' | 'createdAt'>) => {
      if (!api.createReminder) return null
      try {
        const created = await api.createReminder(payload)
        await refresh()
        return created
      } catch (error) {
        console.error('Не удалось создать напоминание', error)
        return null
      }
    },
    [refresh],
  )

  const updateReminder = useCallback(
    async (payload: Partial<Reminder> & { id: number }) => {
      if (!api.updateReminder) return null
      try {
        const updated = await api.updateReminder(payload)
        await refresh()
        return updated
      } catch (error) {
        console.error('Не удалось обновить напоминание', error)
        return null
      }
    },
    [refresh],
  )

  // Инициализация при первом монтировании
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      // Ждём завершения проверки авторизации
      if (authLoading) return
      
      if (!hasNativeApi && !isAuthenticated) {
        // Для веб-версии: пытаемся magic token только один раз
        const isLoginRoute = window.location.hash.includes('login')
        if (!isLoginRoute && !initialized) {
          const params = new URLSearchParams(window.location.search)
          const magicToken = params.get('magic') || params.get('token') || import.meta.env.VITE_MAGIC_TOKEN
          if (magicToken && magicLogin) {
            try {
              await magicLogin(magicToken)
            } catch (error) {
              console.error('Magic login failed', error)
            }
          }
        }
        setLoading(false)
        setInitialized(true)
        return
      }
      
      if (!cancelled) {
        setInitialized(true)
        await refresh()
      }
    }
    void init()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated])
  
  // Обновление данных при изменении статуса авторизации (после инициализации)
  useEffect(() => {
    if (!initialized) return
    if (isAuthenticated) {
      void refresh()
    } else {
      // Очищаем данные при выходе
      setProducts([])
      setOperations([])
      setReservations([])
      setReminders([])
      setDashboard(null)
      setLoading(false)
    }
  }, [initialized, isAuthenticated, refresh])

  const value = useMemo<InventoryContextValue>(
    () => ({
      products,
      operations,
      reservations,
      reminders,
      dashboard,
      loading,
      refresh,
      createProduct,
      updateProduct,
      deleteProduct,
      createOperation,
      deleteOperation,
      updateReservation,
      createReminder,
      updateReminder,
      isDemo: !hasNativeApi,
    }),
    [
      products,
      operations,
      reservations,
      reminders,
      dashboard,
      loading,
      refresh,
      createProduct,
      updateProduct,
      deleteProduct,
      createOperation,
      deleteOperation,
      updateReservation,
      createReminder,
      updateReminder,
    ],
  )

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}

export function useInventory() {
  const ctx = useContext(InventoryContext)
  if (!ctx) throw new Error('useInventory must be used inside InventoryProvider')
  return ctx
}
