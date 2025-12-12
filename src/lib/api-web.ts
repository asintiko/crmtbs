// Web API для работы через REST вместо IPC
import type { InventoryAPI } from '../shared/ipc'
import type {
  NewProductPayload,
  OperationInput,
  OperationWithProduct,
  ProductSummary,
  Reservation,
  Reminder,
  UpdateProductPayload,
  LoginPayload,
  CreateUserPayload,
  UpdateUserPayload,
  User,
  Session,
  DashboardSummary,
  SyncSnapshot,
} from '../shared/types'

// Дефолтный сервер для синхронизации (можно переопределить через VITE_API_BASE)
const DEFAULT_SERVER = 'http://144.31.17.123:1122/api'
const API_BASE = import.meta.env.VITE_API_BASE || DEFAULT_SERVER
const SESSION_TOKEN_KEY = 'session_token'

function getAuthToken(): string | null {
  return localStorage.getItem(SESSION_TOKEN_KEY)
}

function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem(SESSION_TOKEN_KEY, token)
  } else {
    localStorage.removeItem(SESSION_TOKEN_KEY)
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    })
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Не удалось связаться с сервером. Проверьте подключение.',
    )
  }

  if (response.status === 401) {
    localStorage.removeItem(SESSION_TOKEN_KEY)
    setAuthToken(null)
    // Просто бросаем 401 — роутер сам покажет /login, без цикличных редиректов
    throw new Error('Не авторизован')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  return response.json()
}

export const webApi: InventoryAPI = {
  // Auth
  login: async (payload: LoginPayload) => {
    const result = await request<{ user: User; session: Session }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    setAuthToken(result.session.token)
    return result
  },

  logout: async () => {
    await request('/auth/logout', { method: 'POST' })
    setAuthToken(null)
  },

  magicLogin: async (token: string) => {
    const result = await request<{ user: User; session: Session }>('/auth/magic', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
    setAuthToken(result.session.token)
    return result
  },

  getCurrentUser: async () => {
    const result = await request<{ user: User }>('/auth/me')
    return result.user
  },

  checkSession: async (token: string) => {
    setAuthToken(token)
    const result = await request<{ user: User }>('/auth/me')
    return result.user
  },

  // Users
  listUsers: async () => {
    return request<User[]>('/users')
  },

  createUser: async (payload: CreateUserPayload) => {
    return request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  updateUser: async (payload: UpdateUserPayload) => {
    return request<User>(`/users/${payload.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  deleteUser: async (id: number) => {
    await request(`/users/${id}`, { method: 'DELETE' })
  },

  // Products
  listProducts: async () => {
    return request<ProductSummary[]>('/products')
  },

  createProduct: async (payload: NewProductPayload) => {
    return request<ProductSummary>('/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  updateProduct: async (payload: UpdateProductPayload) => {
    return request<ProductSummary>(`/products/${payload.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  deleteProduct: async (id: number) => {
    await request(`/products/${id}`, { method: 'DELETE' })
  },

  // Operations
  listOperations: async () => {
    return request<OperationWithProduct[]>('/operations')
  },

  createOperation: async (payload: OperationInput) => {
    return request<OperationWithProduct>('/operations', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  deleteOperation: async (id: number) => {
    await request(`/operations/${id}`, { method: 'DELETE' })
  },

  // Dashboard
  getDashboard: async () => {
    return request<DashboardSummary>('/dashboard')
  },

  // Reservations
  listReservations: async () => {
    return request<Reservation[]>('/reservations')
  },

  updateReservation: async (payload: Partial<Reservation> & { id: number }) => {
    return request<Reservation>(`/reservations/${payload.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  // Reminders
  listReminders: async () => {
    return request<Reminder[]>('/reminders')
  },

  createReminder: async (payload: Omit<Reminder, 'id' | 'done' | 'createdAt'>) => {
    return request<Reminder>('/reminders', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  updateReminder: async (payload: Partial<Reminder> & { id: number }) => {
    return request<Reminder>(`/reminders/${payload.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  // Backup
  backupNow: async () => {
    throw new Error('Backup not implemented in web version')
  },

  getPaths: async () => {
    throw new Error('Paths not available in web version')
  },

  // Updates
  checkForUpdates: async () => {
    throw new Error('Updates not implemented in web version')
  },

  openReleaseUrl: async (url: string) => {
    window.open(url, '_blank')
  },

  // Sync
  saveGoogleDriveConfig: async (clientId: string, clientSecret: string) => {
    return request('/sync/config', {
      method: 'POST',
      body: JSON.stringify({ clientId, clientSecret }),
    })
  },

  getGoogleDriveConfig: async () => {
    return request('/sync/config')
  },

  getGoogleDriveAuthUrl: async (_redirectUri?: string) => {
    throw new Error('Google Drive auth not implemented in web version')
  },

  setGoogleDriveTokens: async (_code: string, _redirectUri?: string) => {
    throw new Error('Google Drive tokens not implemented in web version')
  },

  startSync: async () => {
    throw new Error('Sync not implemented in web version')
  },

  // Full snapshot sync (server-side)
  syncPull: async () => {
    return request<SyncSnapshot>('/sync/full')
  },

  syncPush: async (snapshot: SyncSnapshot) => {
    return request<{ success: boolean }>('/sync/full', {
      method: 'POST',
      body: JSON.stringify(snapshot),
    })
  },
}
