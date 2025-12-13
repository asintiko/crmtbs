import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  ChevronsUpDown,
  CreditCard,
  Loader2,
  PlusCircle,
  RotateCcw,
  Search,
  Shield,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import clsx from 'clsx'

import { formatNumber } from '@/lib/formatters'
import { searchProducts } from '@/lib/search'
import { useInventory } from '@/providers/InventoryProvider'
import type { OperationType, ProductSummary } from '@/shared/types'
import { Modal } from './Modal'

const operationOptions: Array<{
  value: OperationType
  label: string
  hint: string
  description: string
  icon: LucideIcon
  tone: string
  badgeTone: string
  iconTone: string
  iconBg: string
}> = [
  {
    value: 'purchase',
    label: 'Приход',
    hint: 'Склад +',
    description: 'Пополняет остаток',
    icon: ArrowDownLeft,
    tone: 'text-emerald-600 dark:text-emerald-300',
    badgeTone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200',
    iconTone: 'text-emerald-600 dark:text-emerald-300',
    iconBg: 'bg-emerald-50 dark:bg-emerald-500/10',
  },
  {
    value: 'sale',
    label: 'Продажа',
    hint: 'Склад -',
    description: 'Списывает со склада',
    icon: ArrowUpRight,
    tone: 'text-rose-600 dark:text-rose-300',
    badgeTone: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200',
    iconTone: 'text-rose-600 dark:text-rose-300',
    iconBg: 'bg-rose-50 dark:bg-rose-500/10',
  },
  {
    value: 'reserve',
    label: 'Бронирование',
    hint: 'Бронь +',
    description: 'Фиксирует под клиента',
    icon: Shield,
    tone: 'text-blue-600 dark:text-blue-300',
    badgeTone: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200',
    iconTone: 'text-blue-600 dark:text-blue-300',
    iconBg: 'bg-blue-50 dark:bg-blue-500/10',
  },
  {
    value: 'ship_on_credit',
    label: 'Отгрузка в долг',
    hint: 'Склад -, Долг +',
    description: 'Учитывает дебиторку',
    icon: CreditCard,
    tone: 'text-amber-700 dark:text-amber-300',
    badgeTone: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200',
    iconTone: 'text-amber-700 dark:text-amber-300',
    iconBg: 'bg-amber-50 dark:bg-amber-500/10',
  },
  {
    value: 'close_debt',
    label: 'Закрытие долга',
    hint: 'Долг -',
    description: 'Погашение задолженности',
    icon: BadgeCheck,
    tone: 'text-emerald-600 dark:text-emerald-300',
    badgeTone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200',
    iconTone: 'text-emerald-600 dark:text-emerald-300',
    iconBg: 'bg-emerald-50 dark:bg-emerald-500/10',
  },
  {
    value: 'return',
    label: 'Возврат',
    hint: 'Склад +',
    description: 'Возвращает товар на склад',
    icon: RotateCcw,
    tone: 'text-emerald-600 dark:text-emerald-300',
    badgeTone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200',
    iconTone: 'text-emerald-600 dark:text-emerald-300',
    iconBg: 'bg-emerald-50 dark:bg-emerald-500/10',
  },
]

type Props = {
  onClose: () => void
  onCreated?: () => void
  onRequestProduct?: (payload: { name: string; type: OperationType }) => void
  initialProductId?: number | null
  initialType?: OperationType
}

export function OperationForm({
  onClose,
  onCreated,
  onRequestProduct,
  initialProductId,
  initialType,
}: Props) {
  const { products, operations, createOperation, createProduct } = useInventory()

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<ProductSummary | null>(null)
  const [type, setType] = useState<OperationType>(initialType ?? 'purchase')
  const [quantity, setQuantity] = useState<string>('1')
  const [customer, setCustomer] = useState('')
  const [contact, setContact] = useState('')
  const [paid, setPaid] = useState(true)
  const [permitNumber, setPermitNumber] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [comment, setComment] = useState('')
  const [bundleTitle, setBundleTitle] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const suggestionRef = useRef<HTMLDivElement | null>(null)
  const typeMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const nextType = initialType ?? 'purchase'
    setType(nextType)
    setPaid(nextType === 'ship_on_credit' ? false : true)
  }, [initialType])

  useEffect(() => {
    if (!initialProductId) return
    const found = products.find((p) => p.id === initialProductId)
    if (found) {
      setSelected(found)
      setQuery(found.name)
    }
  }, [initialProductId, products])

  const normalizedQuery = query.trim()
  const allowSuggestions = normalizedQuery.length >= 1

  const matches = useMemo(() => {
    const results = allowSuggestions ? searchProducts(products, query) : []
    return results
  }, [allowSuggestions, products, query])

  const selectedProduct = selected ?? (matches.length === 1 ? matches[0].product : null)

  const quantityNumber = Number(quantity)
  const customerValue = customer.trim()
  const customerKey = customerValue.toLowerCase()
  const commentValue = comment.trim()
  const contactValue = contact.trim()
  const permitValue = permitNumber.trim()
  const dueValue = dueAt ? new Date(dueAt).toISOString() : undefined
  const currentDebt = useMemo(() => {
    if (!selectedProduct || !customerKey) return null

    const debt = operations.reduce((acc, op) => {
      if (op.productId !== selectedProduct.id) return acc
      if (!op.customer) return acc
      if (op.customer.trim().toLowerCase() !== customerKey) return acc
      if (op.type === 'ship_on_credit') return acc + op.quantity
      if (op.type === 'close_debt') return acc - op.quantity
      return acc
    }, 0)

    return Math.max(debt, 0)
  }, [customerKey, operations, selectedProduct])
  const hasDebtLimit = type === 'close_debt' && (currentDebt ?? 0) > 0
  const risky =
    selectedProduct &&
    ['sale', 'sale_from_reserve', 'ship_on_credit'].includes(type) &&
    quantityNumber > selectedProduct.stock.available
  const selectedTypeOption =
    operationOptions.find((option) => option.value === type) ?? operationOptions[0]
  const SelectedTypeIcon = selectedTypeOption.icon
  const isSaleType = type === 'sale' || type === 'sale_from_reserve'
  const showPayment = ['sale', 'sale_from_reserve', 'ship_on_credit', 'close_debt'].includes(type)
  const showDueField = type === 'reserve' || (!paid && showPayment) || type === 'ship_on_credit'

  useEffect(() => {
    if (!allowSuggestions) {
      setShowSuggestions(false)
    }
    setHighlightIndex(0)
  }, [allowSuggestions])

  useEffect(() => {
    setHighlightIndex(0)
  }, [matches.length, showSuggestions])

  useEffect(() => {
    if (!['sale', 'ship_on_credit', 'close_debt', 'reserve'].includes(type)) {
      setPaid(true)
    }
    if (['reserve', 'ship_on_credit'].includes(type) || !paid) {
      if (!dueAt) {
        setDueAt(new Date().toISOString().slice(0, 16))
      }
    } else {
      setDueAt('')
    }
  }, [type, paid, dueAt])

  useEffect(() => {
    const handler = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      const withinSuggestions = suggestionRef.current?.contains(target ?? null)
      const withinTypeMenu = typeMenuRef.current?.contains(target ?? null)

      if (!withinSuggestions) {
        setShowSuggestions(false)
      }
      if (!withinTypeMenu) {
        setShowTypeMenu(false)
      }
    }

    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!quantityNumber || quantityNumber <= 0 || Number.isNaN(quantityNumber)) {
      setError('Укажите корректное количество')
      return
    }

    if (['ship_on_credit', 'close_debt'].includes(type) && !customerValue) {
      setError('Укажите клиента для операций с долгом')
      return
    }

    let productToUse = selectedProduct
    const needAutoCreate = !productToUse && normalizedQuery && matches.length === 0

    setSubmitting(true)
    try {
      if (needAutoCreate) {
        const created = await createProduct({ name: normalizedQuery })
        if (!created) {
          throw new Error('Не удалось автоматически создать товар')
        }
        productToUse = created
        setSelected(created)
      } else if (!productToUse) {
        throw new Error('Выберите товар')
      }

      const productId = productToUse?.id
      if (!productId) {
        throw new Error('Выберите товар')
      }

      let debtValue = currentDebt ?? 0
      if (type === 'close_debt') {
        debtValue = operations.reduce((acc, op) => {
          if (op.productId !== productId) return acc
          if (!op.customer) return acc
          if (op.customer.trim().toLowerCase() !== customerKey) return acc
          if (op.type === 'ship_on_credit') return acc + op.quantity
          if (op.type === 'close_debt') return acc - op.quantity
          return acc
        }, 0)

        debtValue = Math.max(debtValue, 0)
        if (debtValue <= 0) {
          throw new Error('Долг для этого клиента отсутствует')
        }
        if (quantityNumber > debtValue) {
          throw new Error('Сумма погашения превышает остаток долга')
        }
      }

      const occurredAt = date ? new Date(date).toISOString() : new Date().toISOString()
      await createOperation({
        productId: productId,
        type,
        quantity: quantityNumber,
        customer: customerValue || undefined,
        contact: contactValue || undefined,
        permitNumber: permitValue || undefined,
        paid,
        dueAt: dueValue,
        bundleTitle: bundleTitle.trim() || undefined,
        comment: commentValue || undefined,
        occurredAt,
      })
      // Напоминания создаются автоматически в backend
      onCreated?.()
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось сохранить операцию'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Добавить операцию" onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Оборудование
          </label>
          <div className="relative" ref={suggestionRef}>
            <div className="pointer-events-none absolute left-3 top-2.5 text-slate-400">
              <Search size={16} />
            </div>
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSelected(null)
                setShowSuggestions(e.target.value.trim().length >= 1)
                setHighlightIndex(0)
              }}
              onKeyDown={(e) => {
                if (showSuggestions && matches.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setHighlightIndex((prev) => (prev + 1) % matches.length)
                    return
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setHighlightIndex((prev) => (prev - 1 + matches.length) % matches.length)
                    return
                  }
                }
                if (e.key === 'Enter' && showSuggestions && matches.length > 0) {
                  e.preventDefault()
                  const choice = matches[highlightIndex]?.product ?? matches[0].product
                  setSelected(choice)
                  setQuery(choice.name)
                  setShowSuggestions(false)
                }
              }}
              onFocus={() => setShowSuggestions(allowSuggestions)}
              placeholder="Начните вводить название или синоним..."
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 outline-none ring-brand/40 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            {allowSuggestions && showSuggestions && matches.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                {matches.map((match, index) => (
                  <button
                    type="button"
                    key={match.product.id}
                    onClick={() => {
                      setSelected(match.product)
                      setQuery(match.product.name)
                      setShowSuggestions(false)
                      setHighlightIndex(index)
                    }}
                    className={clsx(
                      'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800',
                      selectedProduct?.id === match.product.id && 'bg-slate-100 dark:bg-slate-800',
                      highlightIndex === index && 'bg-slate-100 dark:bg-slate-800',
                    )}
                  >
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {match.product.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Совпадение: {match.match}
                        {match.viaAlias ? ' (синоним)' : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end text-xs text-slate-500 dark:text-slate-400">
                      <span>Доступно: {match.product.stock.available}</span>
                      {match.product.sku && <span>SKU: {match.product.sku}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {!allowSuggestions && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Начните вводить название или синоним, чтобы выбрать товар.
            </p>
          )}
          {allowSuggestions && showSuggestions && matches.length === 0 && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 w-full rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-600 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <div className="flex items-center justify-between">
                <span>Ничего не найдено.</span>
                {onRequestProduct && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowSuggestions(false)
                      onRequestProduct({ name: normalizedQuery, type })
                    }}
                    className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-1 text-white"
                  >
                    <PlusCircle size={14} />
                    Создать новый товар
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div ref={typeMenuRef} className="relative">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Тип операции
            </label>
            <button
              type="button"
              onClick={() => setShowTypeMenu((prev) => !prev)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm transition hover:border-brand hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand/40 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <div className="flex flex-1 items-center gap-3">
                <span
                  className={clsx(
                    'flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200/60 text-base shadow-inner dark:border-slate-700/70',
                    selectedTypeOption.iconBg,
                  )}
                >
                  <SelectedTypeIcon className={clsx('h-5 w-5', selectedTypeOption.iconTone)} />
                </span>
                <div className="flex flex-col text-left leading-tight">
                  <span className={clsx('text-sm font-semibold', selectedTypeOption.tone)}>
                    {selectedTypeOption.label}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedTypeOption.description}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={clsx(
                    'whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide',
                    selectedTypeOption.badgeTone,
                  )}
                >
                  {selectedTypeOption.hint}
                </span>
                <ChevronsUpDown size={16} className="text-slate-400" />
              </div>
            </button>
            {showTypeMenu && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                {operationOptions.map((op) => (
                  <button
                    type="button"
                    key={op.value}
                    onClick={() => {
                      setType(op.value)
                      setShowTypeMenu(false)
                    }}
                    className={clsx(
                      'flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition',
                      'hover:bg-slate-50 dark:hover:bg-slate-800',
                      op.value === type && 'bg-slate-100 ring-1 ring-brand/30 dark:bg-slate-800',
                    )}
                  >
                    <div className="flex flex-1 items-center gap-3">
                      <span
                        className={clsx(
                          'flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200/60 text-sm shadow-inner dark:border-slate-700/70',
                          op.iconBg,
                        )}
                      >
                        <op.icon className={clsx('h-4 w-4', op.iconTone)} />
                      </span>
                      <div className="flex flex-col leading-tight">
                        <span className={clsx('text-sm font-semibold', op.tone)}>{op.label}</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {op.description}
                        </span>
                      </div>
                    </div>
                    <span
                      className={clsx(
                        'whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide',
                        op.badgeTone,
                      )}
                    >
                      {op.hint}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Количество
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              max={hasDebtLimit ? currentDebt ?? undefined : undefined}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/40 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            {type === 'close_debt' && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Текущий долг: {currentDebt !== null ? formatNumber(currentDebt) : '—'} шт.
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Дата
            </label>
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/40 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Компания / клиент
            </label>
            <input
              type="text"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="ООО Ритм"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/40 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Контакт / телефон
            </label>
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Имя, телефон"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/40 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
        </div>

        {(showPayment || showDueField || isSaleType) && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {showPayment && (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                <input
                  id="paid"
                  type="checkbox"
                  checked={paid}
                  onChange={(e) => setPaid(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                />
                <label htmlFor="paid" className="flex flex-col text-sm">
                  <span className="font-semibold">Оплачено</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Для долга/броней можно оставить неотмеченным
                  </span>
                </label>
              </div>
            )}

            {isSaleType && (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Номер разрешения на приобретение
                </label>
                <input
                  type="text"
                  value={permitNumber}
                  onChange={(e) => setPermitNumber(e.target.value)}
                  placeholder="№12345-РАЗР"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/40 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            )}

            {showDueField && (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Срок оплаты / брони
                </label>
                <input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/40 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            )}
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Комплект / выдача (для объединения позиций)
          </label>
          <input
            type="text"
            value={bundleTitle}
            onChange={(e) => setBundleTitle(e.target.value)}
            placeholder="Например: Отгрузка для клиента"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/40 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Комментарий
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand/40 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            placeholder="Описание, партия, примечания"
          />
        </div>

        {selectedProduct && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Доступно: {selectedProduct.stock.available} • В брони: {selectedProduct.stock.reserved} •
            Долг: {selectedProduct.stock.debt}
          </div>
        )}

        {risky && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100">
            <AlertTriangle size={14} />
            Количество превышает доступный остаток. Подтвердите корректность.
          </div>
        )}

        {error && <p className="text-sm font-semibold text-rose-600 dark:text-rose-300">{error}</p>}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-muted disabled:opacity-60"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Сохранить
          </button>
        </div>
      </form>
    </Modal>
  )
}
