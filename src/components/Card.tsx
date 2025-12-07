import clsx from 'clsx'

type CardProps = {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-4">
      <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
      {action}
    </div>
  )
}

export function CardContent({ children }: CardProps) {
  return <div className="space-y-3">{children}</div>
}
