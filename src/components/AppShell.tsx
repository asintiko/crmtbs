import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Archive,
  BookOpenCheck,
  ChevronDown,
  Home,
  ListChecks,
  Menu,
  Settings,
  Warehouse,
} from 'lucide-react'
import clsx from 'clsx'

import { ThemeToggle } from './ThemeToggle'

export type NavItem = {
  label: string
  path: string
  icon: React.ComponentType<{ size?: number | string; className?: string }>
}

const defaultNav: NavItem[] = [
  { label: 'Главная', path: '/', icon: Home },
  { label: 'Склад', path: '/stock', icon: Warehouse },
  { label: 'Журнал', path: '/journal', icon: ListChecks },
  { label: 'Справочник', path: '/catalog', icon: BookOpenCheck },
  { label: 'Настройки', path: '/settings', icon: Settings },
]

type Props = {
  children: React.ReactNode
  items?: NavItem[]
  isDemo?: boolean
}

export function AppShell({ children, items = defaultNav, isDemo = false }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(true)
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 768px)').matches,
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(min-width: 768px)')
    const handler = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches)
      if (event.matches) {
        setMobileOpen(false)
      }
    }
    setIsDesktop(media.matches)
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [])

  const activePath = useMemo(() => {
    const match = items.find((item) => item.path === location.pathname)
    return match?.path ?? '/'
  }, [items, location.pathname])

  const mainItem = useMemo(() => items.find((item) => item.path === '/'), [items])
  const stockItem = useMemo(() => items.find((item) => item.path === '/stock'), [items])
  const settingsItem = useMemo(
    () => items.find((item) => item.path === '/settings' || item.label.toLowerCase() === 'настройки'),
    [items],
  )
  const secondaryItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.path !== '/' && item.path !== '/stock' && item.path !== (settingsItem?.path ?? ''),
      ),
    [items, settingsItem],
  )
  const secondaryActive = secondaryItems.some((item) => item.path === activePath)

  const renderNavLink = (item: NavItem) => {
    const Icon = item.icon
    const isActive = activePath === item.path
    return (
      <Link
        key={item.path}
        to={item.path}
        className={clsx(
          'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-brand/10 hover:text-brand dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white',
          isActive && 'bg-brand/10 text-brand shadow-sm ring-1 ring-brand/30 dark:bg-slate-800 dark:text-white',
          collapsed && 'justify-center px-2',
        )}
        onClick={() => {
          if (!isDesktop) setMobileOpen(false)
        }}
      >
        <Icon size={18} className={clsx('flex-shrink-0', isActive ? 'text-brand' : 'text-slate-500')} />
        {!collapsed && <span>{item.label}</span>}
      </Link>
    )
  }

  return (
    <div className="flex min-h-screen bg-surface-light text-slate-900 transition-colors dark:bg-surface-dark dark:text-slate-50">
      {!isDesktop && mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-label="Закрыть меню"
        />
      )}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex h-full flex-col border-r border-slate-200 bg-white/80 px-3 py-4 shadow-sm backdrop-blur transition-transform duration-200 dark:border-slate-800 dark:bg-slate-900/70 md:static md:h-auto md:translate-x-0',
          isDesktop ? (collapsed ? 'md:w-16' : 'md:w-64') : 'w-72',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <div className="mb-6 flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Archive size={18} />
            </div>
            {!collapsed && (
              <div>
                <p className="text-sm font-semibold">Inventory Desktop</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Офлайн-склад</p>
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label={isDesktop ? (collapsed ? 'Развернуть меню' : 'Свернуть меню') : 'Закрыть меню'}
            onClick={() => (isDesktop ? setCollapsed((prev) => !prev) : setMobileOpen(false))}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              className={clsx('transition-transform', isDesktop && collapsed ? 'rotate-180' : '')}
            >
              <path
                fill="currentColor"
                d="M15.41 7.41L14 6l-6 6l6 6l1.41-1.41L10.83 12z"
              />
            </svg>
          </button>
        </div>

        <nav className="flex-1 space-y-1">
          {mainItem && renderNavLink(mainItem)}

          {stockItem && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  navigate(stockItem.path)
                  if (!isDesktop) setMobileOpen(false)
                }}
                className={clsx(
                  'group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-brand/10 hover:text-brand dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white',
                  (activePath === stockItem.path || secondaryActive) &&
                    'bg-brand/10 text-brand shadow-sm ring-1 ring-brand/30 dark:bg-slate-800 dark:text-white',
                  collapsed && 'justify-center px-2',
                )}
              >
                <stockItem.icon
                  size={18}
                  className={clsx(
                    'flex-shrink-0',
                    activePath === stockItem.path || secondaryActive ? 'text-brand' : 'text-slate-500',
                  )}
                />
                {!collapsed && <span>{stockItem.label}</span>}
                {!collapsed && secondaryItems.length > 0 && (
                  <span
                    className="ml-auto rounded-lg p-1 text-slate-500 transition hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMoreOpen((prev) => !prev)
                    }}
                    aria-label="Развернуть разделы склада"
                  >
                    <ChevronDown
                      size={14}
                      className={clsx('transition-transform', moreOpen ? 'rotate-180' : '')}
                    />
                  </span>
                )}
              </button>
              {secondaryItems.length > 0 && moreOpen && (
                <div className={clsx('space-y-1', !collapsed && 'pl-2')}>
                  {secondaryItems.map(renderNavLink)}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className={clsx('mt-auto space-y-2 pt-4', collapsed ? 'px-1' : 'px-1')}>
          {settingsItem && (
            <div>
              {renderNavLink(settingsItem)}
            </div>
          )}
          {isDemo && (
            <div className="mb-3 rounded-lg border border-dashed border-amber-400/70 bg-amber-50/60 px-3 py-2 text-xs font-medium text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200">
              Демоданные
            </div>
          )}
          <ThemeToggle compact={collapsed} />
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white/60 px-6 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={
                isDesktop
                  ? collapsed
                    ? 'Открыть меню'
                    : 'Свернуть меню'
                  : mobileOpen
                    ? 'Закрыть меню'
                    : 'Открыть меню'
              }
              onClick={() => {
                if (isDesktop) {
                  setCollapsed((prev) => !prev)
                } else {
                  setMobileOpen((prev) => !prev)
                }
              }}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:border-brand hover:text-brand dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Menu size={18} />
            </button>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Inventory Desktop
            </p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">Система складского учета</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-500/10 dark:text-green-200">
              Офлайн-first
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              SQLite Local
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-slate-50/60 px-6 py-5 dark:bg-slate-900/60">
          {children}
        </main>
      </div>
    </div>
  )
}
