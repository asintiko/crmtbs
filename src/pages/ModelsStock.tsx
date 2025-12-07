import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, History, Package } from 'lucide-react'
import clsx from 'clsx'
import { useNavigate } from 'react-router-dom'

import { Card, CardContent, CardHeader } from '@/components/Card'
import { useInventory } from '@/providers/InventoryProvider'
import { formatNumber } from '@/lib/formatters'
import type { ProductSummary, StockSnapshot } from '@/shared/types'

interface ModelGroup {
  model: string
  products: ProductSummary[]
  stock: StockSnapshot
  minStock: number
  hasLowStock: boolean
  hasImportPermit: boolean
}

export function ModelsStockPage() {
  const { products, loading } = useInventory()
  const navigate = useNavigate()
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  // Группируем товары по моделям
  const modelGroups = useMemo(() => {
    const groups = new Map<string, ModelGroup>()

    products.forEach((product) => {
      if (!product.model) return // Пропускаем товары без модели

      const model = product.model.trim()
      if (!model) return

      const existing = groups.get(model)
      if (existing) {
        // Добавляем товар в существующую группу
        existing.products.push(product)
        // Суммируем остатки
        existing.stock.onHand += product.stock.onHand
        existing.stock.reserved += product.stock.reserved
        existing.stock.debt += product.stock.debt
        existing.stock.balance += product.stock.balance
        existing.stock.available += product.stock.available
        // Обновляем минимальный остаток (берем максимальный из всех)
        existing.minStock = Math.max(existing.minStock, product.minStock)
        // Обновляем флаги
        existing.hasLowStock = existing.hasLowStock || product.stock.available < product.minStock
        existing.hasImportPermit = existing.hasImportPermit || product.hasImportPermit
      } else {
        // Создаем новую группу
        groups.set(model, {
          model,
          products: [product],
          stock: {
            onHand: product.stock.onHand,
            reserved: product.stock.reserved,
            debt: product.stock.debt,
            balance: product.stock.balance,
            available: product.stock.available,
          },
          minStock: product.minStock,
          hasLowStock: product.stock.available < product.minStock,
          hasImportPermit: product.hasImportPermit,
        })
      }
    })

    // Сортируем по названию модели
    return Array.from(groups.values()).sort((a, b) => a.model.localeCompare(b.model))
  }, [products])

  // Фильтруем по поисковому запросу
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return modelGroups

    const query = searchQuery.toLowerCase()
    return modelGroups.filter((group) => {
      // Поиск по названию модели
      if (group.model.toLowerCase().includes(query)) return true
      // Поиск по названиям товаров в группе
      if (group.products.some((p) => p.name.toLowerCase().includes(query))) return true
      // Поиск по артикулам
      if (group.products.some((p) => p.sku?.toLowerCase().includes(query))) return true
      return false
    })
  }, [modelGroups, searchQuery])

  const toggleModel = (model: string) => {
    setExpandedModels((prev) => {
      const next = new Set(prev)
      if (next.has(model)) {
        next.delete(model)
      } else {
        next.add(model)
      }
      return next
    })
  }

  const isExpanded = (model: string) => expandedModels.has(model)

  return (
    <Card>
      <CardHeader
        title="Остатки по моделям раций"
        action={
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Поиск по модели или товару..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 pl-9 text-sm text-slate-900 outline-none ring-brand/40 placeholder:text-slate-400 focus:border-brand focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              <Package
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
              Данные считаются из журнала операций
            </div>
          </div>
        }
      />
      <CardContent>
        {loading ? (
          <p className="text-sm text-slate-500">Загрузка...</p>
        ) : filteredGroups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
            {searchQuery
              ? 'Модели не найдены по запросу.'
              : 'Нет товаров с указанной моделью. Добавьте модель в карточке товара.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                <thead className="bg-slate-50/80 text-xs uppercase text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-left">Модель</th>
                    <th className="px-4 py-3 text-left">Товаров</th>
                    <th className="px-4 py-3 text-left">Всего</th>
                    <th className="px-4 py-3 text-left">Доступно</th>
                    <th className="px-4 py-3 text-left">Бронь</th>
                    <th className="px-4 py-3 text-left">В долгу</th>
                    <th className="px-4 py-3 text-left">Инфо</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredGroups.map((group) => {
                    const expanded = isExpanded(group.model)
                    return (
                      <>
                        <tr
                          key={group.model}
                          className={clsx(
                            'cursor-pointer text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900/50',
                            group.hasLowStock && 'bg-rose-50/70 dark:bg-rose-500/10',
                          )}
                          onClick={() => toggleModel(group.model)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="flex h-6 w-6 items-center justify-center rounded transition hover:bg-slate-200 dark:hover:bg-slate-700"
                              >
                                {expanded ? (
                                  <ChevronDown size={16} className="text-slate-600 dark:text-slate-300" />
                                ) : (
                                  <ChevronRight size={16} className="text-slate-600 dark:text-slate-300" />
                                )}
                              </button>
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {group.model}
                                </span>
                                {group.hasLowStock && (
                                  <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-700 dark:bg-rose-500/10 dark:text-rose-100">
                                    Минимум: {group.minStock}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                            {group.products.length}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                            {formatNumber(group.stock.onHand)}
                          </td>
                          <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-300">
                            {formatNumber(group.stock.available)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                              {formatNumber(group.stock.reserved)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                group.stock.debt > 0
                                  ? 'rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-200'
                                  : 'text-xs text-slate-500'
                              }
                            >
                              {formatNumber(group.stock.debt)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {group.hasImportPermit && (
                                <span
                                  className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/40"
                                  title="Есть разрешение на ввоз"
                                >
                                  ✓
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                        {expanded && (
                          <>
                            {group.products.map((product) => (
                              <tr
                                key={product.id}
                                className="bg-slate-50/50 text-slate-600 dark:bg-slate-900/30 dark:text-slate-300"
                              >
                                <td className="px-4 py-2 pl-12">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-slate-900 dark:text-white">
                                      {product.name}
                                    </span>
                                    {product.sku && (
                                      <span className="text-xs text-slate-500 dark:text-slate-400">
                                        Артикул: {product.sku}
                                      </span>
                                    )}
                                    {product.aliases.length > 0 && (
                                      <span className="text-xs text-slate-500 dark:text-slate-400">
                                        Теги: {product.aliases.map((a) => a.label).join(', ')}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-2">
                                  <span className="text-xs text-slate-400">—</span>
                                </td>
                                <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">
                                  {formatNumber(product.stock.onHand)}
                                </td>
                                <td className="px-4 py-2 font-medium text-emerald-600 dark:text-emerald-300">
                                  {formatNumber(product.stock.available)}
                                </td>
                                <td className="px-4 py-2">
                                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                                    {formatNumber(product.stock.reserved)}
                                  </span>
                                </td>
                                <td className="px-4 py-2">
                                  <span
                                    className={
                                      product.stock.debt > 0
                                        ? 'rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-200'
                                        : 'text-xs text-slate-500'
                                    }
                                  >
                                    {formatNumber(product.stock.debt)}
                                  </span>
                                </td>
                                <td className="px-4 py-2">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      navigate(`/journal?productId=${product.id}`)
                                    }}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand"
                                  >
                                    <History size={12} />
                                    История
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

