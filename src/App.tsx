import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { BookOpen, Home, ListChecks, Settings, Warehouse, Shield, Package } from 'lucide-react'

import { AppShell, type NavItem } from '@/components/AppShell'
import { DashboardPage } from '@/pages/Dashboard'
import { JournalPage } from '@/pages/Journal'
import { CatalogPage } from '@/pages/Catalog'
import { SettingsPage } from '@/pages/Settings'
import { StockPage } from '@/pages/Stock'
import { ReservationsPage } from '@/pages/Reservations'
import { ModelsStockPage } from '@/pages/ModelsStock'
import { LoginPage } from '@/pages/Login'
import { InventoryProvider } from '@/providers/InventoryProvider'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { AuthProvider, useAuth } from '@/providers/AuthProvider'
import { hasNativeApi } from '@/lib/api'

const navItems: NavItem[] = [
  { label: 'Главная', path: '/', icon: Home },
  { label: 'Склад', path: '/stock', icon: Warehouse },
  { label: 'По моделям', path: '/models-stock', icon: Package },
  { label: 'Журнал', path: '/journal', icon: ListChecks },
  { label: 'Брони', path: '/reservations', icon: Shield },
  { label: 'Справочник', path: '/catalog', icon: BookOpen },
  { label: 'Настройки', path: '/settings', icon: Settings },
]

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <ThemeProvider>
          <InventoryProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <AppShell items={navItems} isDemo={!hasNativeApi}>
                      <Routes>
                        <Route path="/" element={<DashboardPage />} />
                        <Route path="/stock" element={<StockPage />} />
                        <Route path="/models-stock" element={<ModelsStockPage />} />
                        <Route path="/journal" element={<JournalPage />} />
                        <Route path="/reservations" element={<ReservationsPage />} />
                        <Route path="/catalog" element={<CatalogPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </AppShell>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </InventoryProvider>
        </ThemeProvider>
      </AuthProvider>
    </HashRouter>
  )
}

export default App
