import { Moon, Sun } from 'lucide-react'
import clsx from 'clsx'

import { useTheme } from '@/providers/ThemeProvider'

type Props = {
  compact?: boolean
}

export function ThemeToggle({ compact }: Props) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={clsx(
        'inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-100 dark:hover:border-brand',
        compact && 'px-2 py-1.5',
      )}
      aria-label="Переключить тему"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
      {!compact && <span>{isDark ? 'Светлая' : 'Тёмная'}</span>}
    </button>
  )
}
