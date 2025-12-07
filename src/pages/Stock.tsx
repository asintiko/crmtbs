import { useMemo, useState } from 'react'
import { ArrowRight, FileText, History, PlusCircle, Shield, ShieldCheck } from 'lucide-react'
import clsx from 'clsx'
import { useNavigate } from 'react-router-dom'

import { Card, CardContent, CardHeader } from '@/components/Card'
import { OperationForm } from '@/components/OperationForm'
import { BundleOperationForm } from '@/components/BundleOperationForm'
import { ProductForm } from '@/components/ProductForm'
import { NotesViewer } from '@/components/NotesViewer'
import { useInventory } from '@/providers/InventoryProvider'
import { formatNumber } from '@/lib/formatters'
import type { OperationType, ProductSummary } from '@/shared/types'

export function StockPage() {
  const { products, loading } = useInventory()
  const navigate = useNavigate()
  const [showOpForm, setShowOpForm] = useState(false)
  const [showBundleOpForm, setShowBundleOpForm] = useState(false)
  const [showProductForm, setShowProductForm] = useState(false)
  const [operationPreset, setOperationPreset] = useState<{ productId?: number | null; type?: OperationType }>({})
  const [productDraftName, setProductDraftName] = useState('')
  const [permitOnly, setPermitOnly] = useState(false)
  const [notesProduct, setNotesProduct] = useState<ProductSummary | null>(null)

  const visibleProducts = useMemo(
    () => (permitOnly ? products.filter((p) => p.hasImportPermit) : products),
    [permitOnly, products],
  )

  return (
    <>
      <Card>
        <CardHeader
          title="Склад — текущие остатки"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-brand hover:text-brand dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand"
                onClick={() => setShowBundleOpForm(true)}
              >
                <PlusCircle size={14} />
                Комплект товаров
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-muted"
                onClick={() => {
                  setProductDraftName('')
                  setOperationPreset({ type: 'purchase' })
                  setShowOpForm(true)
                }}
              >
                <PlusCircle size={14} />
                Ввод начальных остатков
              </button>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
                Данные считаются из журнала операций
              </div>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-brand dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={permitOnly}
                  onChange={(e) => setPermitOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                />
                Только с разрешением
              </label>
            </div>
          }
        />
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Загрузка...</p>
          ) : visibleProducts.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-300">
              {permitOnly ? 'Нет товаров с разрешением на ввоз.' : 'Товары не найдены.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50/80 text-xs uppercase text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-left">Наименование</th>
                      <th className="px-4 py-3 text-left">Всего</th>
                      <th className="px-4 py-3 text-left">Доступно</th>
                      <th className="px-4 py-3 text-left">Бронь</th>
                      <th className="px-4 py-3 text-left">В долгу</th>
                      <th className="px-4 py-3 text-left">Примечания</th>
                      <th className="px-4 py-3 text-left">Инфо</th>
                      <th className="px-4 py-3 text-left">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {visibleProducts.map((product) => {
                      const isLow = product.stock.available < product.minStock
                      return (
                        <tr
                          key={product.id}
                          className={clsx(
                            'text-slate-700 dark:text-slate-200',
                            isLow && 'bg-rose-50/70 dark:bg-rose-500/10',
                          )}
                        >
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {product.name}
                              </span>
                              {product.sku && (
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  Артикул: {product.sku}
                                </span>
                              )}
                              {product.model && (
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  Модель: {product.model}
                                </span>
                              )}
                              {product.aliases.length > 0 && (
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  Теги: {product.aliases.map((a) => a.label).join(', ')}
                                </span>
                              )}
                              {isLow && (
                                <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-700 dark:bg-rose-500/10 dark:text-rose-100">
                                  Минимум: {product.minStock}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                            {formatNumber(product.stock.onHand)}
                          </td>
                          <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-300">
                            {formatNumber(product.stock.available)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                              {formatNumber(product.stock.reserved)}
                            </span>
                            <button
                              type="button"
                              onClick={() => navigate(`/reservations?productId=${product.id}`)}
                              className="ml-2 text-xs font-semibold text-blue-600 underline decoration-dotted underline-offset-2 transition hover:text-blue-700 dark:text-blue-300"
                            >
                              Детали
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                product.stock.debt > 0
                                  ? 'rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-200'
                                  : 'text-xs text-slate-500'
                              }
                            >
                              {formatNumber(product.stock.debt)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {product.notes ? (
                              <button
                                type="button"
                                onClick={() => setNotesProduct(product)}
                                className="group flex w-full items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-brand hover:bg-brand/5 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-brand"
                                title="Нажмите для просмотра и редактирования примечаний"
                              >
                                <FileText
                                  size={16}
                                  className="mt-0.5 flex-shrink-0 text-slate-400 group-hover:text-brand"
                                />
                                <span className="flex-1 text-xs text-slate-600 line-clamp-2 dark:text-slate-300">
                                  {product.notes}
                                </span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setNotesProduct(product)}
                                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-400 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:hover:border-brand"
                                title="Добавить примечания"
                              >
                                <FileText size={14} />
                                Добавить
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {product.hasImportPermit ? (
                                <span
                                  className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/40"
                                  title="Разрешение есть"
                                >
                                  <ShieldCheck size={16} />
                                </span>
                              ) : (
                                <span
                                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700"
                                  title="Нет разрешения"
                                >
                                  <Shield size={16} />
                                </span>
                              )}
                              {product.archived && (
                                <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                  Архив
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand"
                              onClick={() => navigate(`/journal?productId=${product.id}`)}
                            >
                              <History size={14} />
                              История
                              <ArrowRight size={14} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showOpForm && (
        <OperationForm
          onClose={() => {
            setShowOpForm(false)
            setOperationPreset({})
          }}
          onCreated={() => {
            setShowOpForm(false)
            setOperationPreset({})
          }}
          onRequestProduct={({ name, type }) => {
            setShowOpForm(false)
            setProductDraftName(name)
            setOperationPreset({ type })
            setShowProductForm(true)
          }}
          initialProductId={operationPreset.productId ?? undefined}
          initialType={operationPreset.type}
        />
      )}

      {showBundleOpForm && (
        <BundleOperationForm
          onClose={() => setShowBundleOpForm(false)}
          onCreated={() => setShowBundleOpForm(false)}
        />
      )}

      {showProductForm && (
        <ProductForm
          onClose={() => {
            setShowProductForm(false)
            setProductDraftName('')
            setOperationPreset({})
          }}
          onCreated={(product) => {
            setShowProductForm(false)
            setProductDraftName('')
            setOperationPreset((prev) => ({ ...prev, productId: product.id }))
            setShowOpForm(true)
          }}
          initialName={productDraftName}
        />
      )}

      {notesProduct && (
        <NotesViewer
          product={notesProduct}
          onClose={() => setNotesProduct(null)}
        />
      )}
    </>
  )
}
