import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import type { User, LoginPayload } from '@/shared/types'

type AuthContextValue = {
  user: User | null
  loading: boolean
  login: (payload: LoginPayload) => Promise<void>
  magicLogin?: (token: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  isAuthenticated: boolean
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const SESSION_TOKEN_KEY = 'session_token'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const checkSession = useCallback(async () => {
    try {
      const token = localStorage.getItem(SESSION_TOKEN_KEY)
      if (!token) {
        setUser(null)
        setLoading(false)
        return
      }

      const currentUser = await api.checkSession(token)
      if (currentUser) {
        setUser(currentUser)
      } else {
        localStorage.removeItem(SESSION_TOKEN_KEY)
        setUser(null)
      }
    } catch (error) {
      console.error('Ошибка при проверке сессии', error)
      localStorage.removeItem(SESSION_TOKEN_KEY)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const login = useCallback(
    async (payload: LoginPayload) => {
      try {
        const result = await api.login(payload)
        localStorage.setItem(SESSION_TOKEN_KEY, result.session.token)
        setUser(result.user)
      } catch (error) {
        console.error('Ошибка при входе', error)
        throw error
      }
    },
    [],
  )

  const logout = useCallback(async () => {
    try {
      const token = localStorage.getItem(SESSION_TOKEN_KEY)
      if (token) {
        await api.logout()
        localStorage.removeItem(SESSION_TOKEN_KEY)
      }
      setUser(null)
    } catch (error) {
      console.error('Ошибка при выходе', error)
      localStorage.removeItem(SESSION_TOKEN_KEY)
      setUser(null)
    }
  }, [])

  const magicLogin = useCallback(
    async (token: string) => {
      if (!api.magicLogin) {
        throw new Error('Magic login не поддерживается')
      }
      setLoading(true)
      try {
        const result = await api.magicLogin(token)
        localStorage.setItem(SESSION_TOKEN_KEY, result.session.token)
        setUser(result.user)
      } catch (error) {
        console.error('Ошибка magic login', error)
        throw error
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const refresh = useCallback(async () => {
    try {
      const currentUser = await api.getCurrentUser()
      setUser(currentUser)
    } catch (error) {
      console.error('Ошибка при обновлении пользователя', error)
      setUser(null)
    }
  }, [])

  useEffect(() => {
    void checkSession()
  }, [checkSession])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login,
      magicLogin,
      logout,
      refresh,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === 'admin',
    }),
    [user, loading, login, magicLogin, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
