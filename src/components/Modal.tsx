import { useEffect, useRef } from 'react'

type ModalProps = {
  title: string
  onClose: () => void
  children: React.ReactNode
  widthClass?: string
}

export function Modal({ title, onClose, children, widthClass = 'max-w-2xl' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const focusableSelector =
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector))
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        const active = document.activeElement as HTMLElement | null
        const noActiveInside = active && !dialogRef.current.contains(active)

        if (event.shiftKey) {
          if (noActiveInside || active === first) {
            event.preventDefault()
            last.focus()
          }
        } else if (noActiveInside || active === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [focusableSelector, onClose])

  useEffect(() => {
    if (!dialogRef.current) return
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector))
    const target = focusable.find((el) => !el.hasAttribute('data-autofocus-ignore')) ?? dialogRef.current
    target.focus({ preventScroll: true })
  }, [focusableSelector])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6 backdrop-blur"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        ref={dialogRef}
        className={`w-full ${widthClass} rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl outline-none dark:border-slate-800 dark:bg-slate-900`}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-lg font-semibold text-slate-900 dark:text-white">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
