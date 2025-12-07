import { useState } from 'react'
import { Edit2, FileText } from 'lucide-react'

import { Modal } from './Modal'
import { useInventory } from '@/providers/InventoryProvider'
import type { ProductSummary } from '@/shared/types'

type NotesViewerProps = {
  product: ProductSummary
  onClose: () => void
}

export function NotesViewer({ product, onClose }: NotesViewerProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [notes, setNotes] = useState(product.notes || '')
  const [saving, setSaving] = useState(false)
  const { updateProduct } = useInventory()

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateProduct({
        id: product.id,
        notes: notes.trim() || null,
      })
      setIsEditing(false)
      onClose()
    } catch (error) {
      console.error('Ошибка при сохранении примечаний:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Примечания к товару" onClose={onClose} widthClass="max-w-2xl">
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">
            <FileText size={20} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900 dark:text-white">{product.name}</p>
            {product.sku && (
              <p className="text-xs text-slate-500 dark:text-slate-400">Артикул: {product.sku}</p>
            )}
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Примечания
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={8}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/40 placeholder:text-slate-400 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                placeholder="Введите примечания к товару..."
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setNotes(product.notes || '')
                  setIsEditing(false)
                }}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                disabled={saving}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-muted disabled:opacity-60"
              >
                {saving && <span className="h-3 w-3 animate-ping rounded-full bg-white/70" />}
                Сохранить
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {product.notes ? (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                <p className="whitespace-pre-wrap">{product.notes}</p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-400 dark:border-slate-700">
                Примечания отсутствуют
              </div>
            )}
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand"
              >
                <Edit2 size={16} />
                {product.notes ? 'Редактировать' : 'Добавить примечания'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

