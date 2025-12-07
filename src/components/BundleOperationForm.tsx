import { useState, useMemo } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'

import { Modal } from './Modal'
import { formatNumber } from '@/lib/formatters'
import { searchProducts } from '@/lib/search'
import { useInventory } from '@/providers/InventoryProvider'
import type { OperationType, ProductSummary } from '@/shared/types'

type BundleItem = {
  productId: number
  product: ProductSummary
  quantity: string
}

type BundleOperationFormProps = {
  onClose: () => void
  onCreated: () => void
  initialType?: OperationType
  initialCustomer?: string
}

export function BundleOperationForm({
  onClose,
  onCreated,
  initialType = 'sale',
  initialCustomer = '',
}: BundleOperationFormProps) {
  const { products, createOperation } = useInventory()
  const [type, setType] = useState<OperationType>(initialType)
  const [customer, setCustomer] = useState(initialCustomer)
  const [contact, setContact] = useState('')
  const [paid, setPaid] = useState(type !== 'ship_on_credit')
  const [bundleTitle, setBundleTitle] = useState('')
  const [comment, setComment] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16))
  const [items, setItems] = useState<BundleItem[]>([])
  const [query, setQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const matches = useMemo(() => {
    if (query.trim().length < 1) return []
    return searchProducts(products, query).filter(
      (p) => !items.some((item) => item.productId === p.product.id),
    )
  }, [query, products, items])

  const addItem = (product: ProductSummary) => {
    if (items.some((item) => item.productId === product.id)) return
    setItems([...items, { productId: product.id, product, quantity: '1' }])
    setQuery('')
    setShowSuggestions(false)
  }

  const removeItem = (productId: number) => {
    setItems(items.filter((item) => item.productId !== productId))
  }

  const updateQuantity = (productId: number, quantity: string) => {
    setItems(items.map((item) => (item.productId === productId ? { ...item, quantity } : item)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (items.length === 0) {
      setError('Добавьте хотя бы один товар')
      return
    }

    if (!bundleTitle.trim()) {
      setError('Укажите название комплекта')
      return
    }

    if (['ship_on_credit', 'close_debt'].includes(type) && !customer.trim()) {
      setError('Укажите клиента для операций с долгом')
      return
    }

    // Проверяем корректность количеств
    for (const item of items) {
      const qty = Number(item.quantity)
      if (!qty || qty <= 0 || Number.isNaN(qty)) {
        setError(`Укажите корректное количество для товара "${item.product.name}"`)
        return
      }
    }

    setSubmitting(true)
    const occurredAt = date ? new Date(date).toISOString() : new Date().toISOString()
    const bundleTitleValue = bundleTitle.trim()

    try {
      // Создаем операции для всех товаров с одним bundleTitle
      const promises = items.map((item) =>
        createOperation({
          productId: item.productId,
          type,
          quantity: Number(item.quantity),
          customer: customer.trim() || undefined,
          contact: contact.trim() || undefined,
          paid,
          bundleTitle: bundleTitleValue,
          comment: comment.trim() || undefined,
          occurredAt,
        }),
      )

      await Promise.all(promises)
      onCreated()
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось создать операции'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const typeOptions: Array<{ value: OperationType; label: string }> = [
    { value: 'sale', label: 'Продажа' },
    { value: 'ship_on_credit', label: 'Отгрузка в долг' },
    { value: 'reserve', label: 'Бронь' },
    { value: 'purchase', label: 'Приход' },
    { value: 'return', label: 'Возврат' },
  ]

  return (
    <Modal title="Групповая операция (комплект товаров)" onClose={onClose} widthClass="max-w-4xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Тип операции *
            </label>
            <select
              value={type}
              onChange={(e) => {
                const newType = e.target.value as OperationType
                setType(newType)
                setPaid(newType !== 'ship_on_credit')
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/40 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              {typeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Название комплекта *
            </label>
            <input
              type="text"
              value={bundleTitle}
              onChange={(e) => setBundleTitle(e.target.value)}
              placeholder="Например: Отгрузка для ООО Компания"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/40 placeholder:text-slate-400 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Клиент
            </label>
            <input
              type="text"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Название клиента"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/40 placeholder:text-slate-400 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Контакт
            </label>
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Телефон, email"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/40 placeholder:text-slate-400 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Дата операции
            </label>
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/40 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          {type !== 'ship_on_credit' && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="paid"
                checked={paid}
                onChange={(e) => setPaid(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
              />
              <label htmlFor="paid" className="text-sm text-slate-700 dark:text-slate-300">
                Оплачено
              </label>
            </div>
          )}
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Комментарий
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/40 placeholder:text-slate-400 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            placeholder="Дополнительная информация о комплекте..."
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Товары в комплекте ({items.length})
          </label>

          {/* Поиск и добавление товаров */}
          <div className="relative mb-3">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Поиск товара для добавления..."
                className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 py-2 text-sm text-slate-900 outline-none ring-brand/40 placeholder:text-slate-400 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>

            {/* Подсказки товаров */}
            {showSuggestions && matches.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                {matches.map((match) => (
                  <button
                    key={match.product.id}
                    type="button"
                    onClick={() => addItem(match.product)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{match.product.name}</p>
                      {match.product.sku && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Артикул: {match.product.sku}
                        </p>
                      )}
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Доступно: {formatNumber(match.product.stock.available)}
                      </p>
                    </div>
                    <Plus size={16} className="text-brand" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Список добавленных товаров */}
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400 dark:border-slate-700">
              Товары не добавлены. Используйте поиск выше для добавления товаров.
            </div>
          ) : (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
              {items.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900"
                >
                  <button
                    type="button"
                    onClick={() => removeItem(item.productId)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-rose-500 transition hover:bg-rose-100 dark:hover:bg-rose-900/20"
                  >
                    <Trash2 size={16} />
                  </button>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 dark:text-white">{item.product.name}</p>
                    {item.product.sku && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Артикул: {item.product.sku}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Доступно: {formatNumber(item.product.stock.available)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      Количество:
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.productId, e.target.value)}
                      className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/40 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      required
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            disabled={submitting}
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={submitting || items.length === 0 || !bundleTitle.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-muted disabled:opacity-60"
          >
            {submitting && <span className="h-3 w-3 animate-ping rounded-full bg-white/70" />}
            Создать операции ({items.length})
          </button>
        </div>
      </form>
    </Modal>
  )
}

