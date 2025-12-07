import { useState, useEffect } from 'react'
import { Clock, AlertCircle } from 'lucide-react'
import clsx from 'clsx'

import { Modal } from '@/components/Modal'
import type { Reminder } from '@/shared/types'

type ReminderFormProps = {
  onClose: () => void
  onSave: (payload: Omit<Reminder, 'id' | 'done' | 'createdAt'>) => Promise<void>
  initialTarget?: {
    type: 'reservation' | 'operation'
    id: number
    title?: string
  }
}

export function ReminderForm({ onClose, onSave, initialTarget }: ReminderFormProps) {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [dueAt, setDueAt] = useState(() => {
    const date = new Date()
    date.setHours(date.getHours() + 1) // По умолчанию через час
    return date.toISOString().slice(0, 16)
  })
  const [quickTemplate, setQuickTemplate] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Быстрые шаблоны напоминаний
  const quickTemplates = [
    {
      id: 'today_evening',
      label: 'Сегодня вечером',
      getDate: () => {
        const date = new Date()
        date.setHours(20, 0, 0, 0) // 20:00 сегодня
        return date
      },
    },
    {
      id: 'tomorrow_morning',
      label: 'Завтра утром',
      getDate: () => {
        const date = new Date()
        date.setDate(date.getDate() + 1)
        date.setHours(9, 0, 0, 0) // 9:00 завтра
        return date
      },
    },
    {
      id: 'in_hour',
      label: 'Через час',
      getDate: () => {
        const date = new Date()
        date.setHours(date.getHours() + 1)
        return date
      },
    },
    {
      id: 'in_day',
      label: 'Через день',
      getDate: () => {
        const date = new Date()
        date.setDate(date.getDate() + 1)
        return date
      },
    },
  ]

  useEffect(() => {
    if (initialTarget?.title) {
      setTitle(initialTarget.title)
    }
  }, [initialTarget])

  const handleQuickTemplate = (templateId: string) => {
    const template = quickTemplates.find((t) => t.id === templateId)
    if (template) {
      const date = template.getDate()
      setDueAt(date.toISOString().slice(0, 16))
      setQuickTemplate(templateId)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setSaving(true)
    try {
      await onSave({
        title: title.trim(),
        message: message.trim() || undefined,
        dueAt: new Date(dueAt).toISOString(),
        targetType: initialTarget?.type ?? null,
        targetId: initialTarget?.id ?? null,
      })
      onClose()
    } catch (error) {
      console.error('Ошибка при создании напоминания:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Новое напоминание" onClose={onClose} widthClass="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {initialTarget && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-500/10 dark:text-blue-200">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} />
              <span className="font-semibold">Привязано к:</span>
              <span>{initialTarget.title || `${initialTarget.type} #${initialTarget.id}`}</span>
            </div>
          </div>
        )}

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Заголовок *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Позвонить клиенту, проверить бронь, заказать товар"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/40 placeholder:text-slate-400 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Когда напомнить
          </label>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {quickTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleQuickTemplate(template.id)}
                  className={clsx(
                    'rounded-lg border px-3 py-2 text-xs font-semibold transition',
                    quickTemplate === template.id
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-brand hover:text-brand dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
                  )}
                >
                  {template.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Clock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => {
                  setDueAt(e.target.value)
                  setQuickTemplate(null)
                }}
                className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 py-2 text-sm text-slate-900 outline-none ring-brand/40 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                required
              />
            </div>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Детали / сообщение
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/40 placeholder:text-slate-400 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            placeholder="Дополнительная информация, комментарии, контакты..."
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            disabled={saving}
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-muted disabled:opacity-60"
          >
            {saving && <span className="h-3 w-3 animate-ping rounded-full bg-white/70" />}
            Создать напоминание
          </button>
        </div>
      </form>
    </Modal>
  )
}

