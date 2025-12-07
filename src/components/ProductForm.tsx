import { useEffect, useState } from 'react'
import { Loader2, Plus, Tag, Trash2 } from 'lucide-react'

import { useInventory } from '@/providers/InventoryProvider'
import type { NewProductPayload, ProductSummary, UpdateProductPayload } from '@/shared/types'
import { Modal } from './Modal'

type Props = {
  onClose: () => void
  onCreated?: (product: ProductSummary) => void
  product?: ProductSummary
  initialName?: string
}

export function ProductForm({ onClose, onCreated, product, initialName }: Props) {
  const { createProduct, updateProduct, deleteProduct, operations, products } = useInventory()

  const [name, setName] = useState(product?.name ?? initialName ?? '')
  const [sku, setSku] = useState(product?.sku ?? '')
  const [model, setModel] = useState(product?.model ?? '')
  const [minStock, setMinStock] = useState(String(product?.minStock ?? 0))
  const [notes, setNotes] = useState(product?.notes ?? '')
  const [aliasInput, setAliasInput] = useState('')
  const [aliases, setAliases] = useState<string[]>(product?.aliases.map((a) => a.label) ?? [])
  const [accessoryIds, setAccessoryIds] = useState<number[]>(
    product?.accessories?.map((a) => a.accessoryId) ?? [],
  )
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [archived, setArchived] = useState(product?.archived ?? false)
  const isEditing = Boolean(product)

  useEffect(() => {
    if (product) {
      setName(product.name)
      setSku(product.sku ?? '')
      setModel(product.model ?? '')
      setMinStock(String(product.minStock))
      setNotes(product.notes ?? '')
      setAliases(product.aliases.map((a) => a.label))
      setArchived(product.archived)
      setAccessoryIds(product.accessories?.map((a) => a.accessoryId) ?? [])
    }
  }, [product])

  const addAlias = () => {
    const trimmed = aliasInput.trim()
    if (trimmed && !aliases.includes(trimmed)) {
      setAliases([...aliases, trimmed])
    }
    setAliasInput('')
  }

  const removeAlias = (label: string) => {
    setAliases((prev) => prev.filter((a) => a !== label))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Название обязательно')
      return
    }

    const payload: NewProductPayload | UpdateProductPayload = {
      name: name.trim(),
      sku: sku.trim() || null,
      model: model.trim() || null,
      minStock: Math.max(0, Number(minStock) || 0),
      notes: notes.trim() || null,
      aliases,
      accessoryIds,
      ...(product
        ? {
            id: product.id,
            archived,
          }
        : {}),
    }

    setSubmitting(true)
    const result = product
      ? await updateProduct(payload as UpdateProductPayload)
      : await createProduct(payload as NewProductPayload)
    setSubmitting(false)

    if (result) {
      onCreated?.(result)
      onClose()
    } else {
      setError('Не удалось сохранить товар')
    }
  }

  const handleDeleteProduct = async () => {
    if (!product) return
    const inUse = operations.some((op) => op.productId === product.id)
    const confirmed = window.confirm(
      inUse
        ? 'Товар используется в операциях. Он будет перемещен в архив. Продолжить?'
        : 'Удалить товар безвозвратно?',
    )
    if (!confirmed) return

    setDeleting(true)
    setError(null)
    try {
      if (inUse) {
        const result = await updateProduct({ id: product.id, archived: true })
        if (!result) {
          throw new Error('Не удалось архивировать товар')
        }
      } else {
        await deleteProduct(product.id)
      }
      onClose()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не удалось удалить товар'
      setError(message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal title={product ? 'Редактировать товар' : 'Новый товар'} onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Название *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Hytera BD505"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/40 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Артикул / SKU
            </label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="BD505"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/40 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Модель
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="BD505"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/40 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Минимальный остаток
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/40 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
        </div>

        {product && (
          <div className="flex items-center gap-2">
            <input
              id="archived"
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            <label htmlFor="archived" className="text-sm text-slate-700 dark:text-slate-200">
              Архивный (не показывать в поиске)
            </label>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Заметки
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/40 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            placeholder="Поставщик, особенности, партия"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Теги
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={aliasInput}
              onChange={(e) => setAliasInput(e.target.value)}
              placeholder="Рация Хайтера 505"
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/40 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addAlias()
                }
              }}
            />
            <button
              type="button"
              onClick={addAlias}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-slate-900"
            >
              <Plus size={14} />
              Добавить
            </button>
          </div>
          {aliases.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {aliases.map((alias) => (
                <span
                  key={alias}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Tag size={12} />
                  {alias}
                  <button
                    type="button"
                    onClick={() => removeAlias(alias)}
                    className="rounded-full px-2 py-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                    aria-label="Удалить тег"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Аксессуары (связанные товары)
          </label>
          <select
            multiple
            value={accessoryIds.map(String)}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions).map((opt) => Number(opt.value))
              setAccessoryIds(selected)
            }}
            className="h-28 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/40 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            {products
              .filter((p) => p.id !== product?.id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.sku ? `(${p.sku})` : ''}
                </option>
              ))}
          </select>
          {accessoryIds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {accessoryIds.map((id) => {
                const p = products.find((item) => item.id === id)
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {p?.name ?? `ID ${id}`}
                    <button
                      type="button"
                      onClick={() => setAccessoryIds((prev) => prev.filter((x) => x !== id))}
                      className="rounded-full px-2 py-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                      aria-label="Удалить аксессуар"
                    >
                      ✕
                    </button>
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {error && <p className="text-sm font-semibold text-rose-600 dark:text-rose-300">{error}</p>}

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          {isEditing ? (
            <button
              type="button"
              onClick={handleDeleteProduct}
              disabled={deleting}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60 dark:border-rose-500/40 dark:text-rose-200 dark:hover:bg-rose-500/10"
            >
              <Trash2 className="h-4 w-4" />
              Удалить товар
            </button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              disabled={deleting}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting || deleting}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-muted disabled:opacity-60"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {product ? 'Сохранить изменения' : 'Сохранить товар'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
