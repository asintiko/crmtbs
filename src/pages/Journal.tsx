import { useMemo, useState } from 'react'
import { CalendarClock, Package, Plus, Trash2, X } from 'lucide-react'
import clsx from 'clsx'
import { useSearchParams, useNavigate } from 'react-router-dom'

import { Card, CardContent, CardHeader } from '@/components/Card'
import { OperationForm } from '@/components/OperationForm'
import { BundleOperationForm } from '@/components/BundleOperationForm'
import { ProductForm } from '@/components/ProductForm'
import { Modal } from '@/components/Modal'
import { ReservationDetailsModal } from '@/components/ReservationDetailsModal'
import { formatDate, formatNumber } from '@/lib/formatters'
import { useInventory } from '@/providers/InventoryProvider'
import type { OperationType, OperationWithProduct } from '@/shared/types'

const typeColors: Record<string, string> = {
  purchase: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200',
  sale: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200',
  reserve: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200',
  reserve_release: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200',
  sale_from_reserve: 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-200',
  ship_on_credit: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-200',
  close_debt: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200',
  return: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
}

export function JournalPage() {
  const [showOpForm, setShowOpForm] = useState(false)
  const [showBundleOpForm, setShowBundleOpForm] = useState(false)
  const [showProductForm, setShowProductForm] = useState(false)
  const { operations, loading, products, deleteOperation, reservations } = useInventory()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [operationPreset, setOperationPreset] = useState<{ productId?: number | null; type?: OperationType }>({})
  const [productDraftName, setProductDraftName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<OperationWithProduct | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState<OperationWithProduct | null>(null)
  
  // Получаем объект брони для модального окна
  const reservationForModal = useMemo(() => {
    if (!selectedReservation || selectedReservation.type !== 'reserve') {
      return null
    }
    
    // Если есть объект reservation, используем его
    if (selectedReservation.reservation) {
      return selectedReservation.reservation
    }
    
    // Если есть reservationId, но нет объекта, пытаемся найти в списке
    if (selectedReservation.reservationId) {
      const found = reservations.find(r => r.id === selectedReservation.reservationId)
      if (found) {
        return found
      }
      
      // Если не нашли в списке, но есть reservationId, создаем временный объект из данных операции
      return {
        id: selectedReservation.reservationId,
        productId: selectedReservation.productId,
        quantity: selectedReservation.quantity,
        customer: selectedReservation.customer ?? null,
        contact: selectedReservation.contact ?? null,
        status: 'active' as const,
        dueAt: selectedReservation.dueAt ?? null,
        comment: selectedReservation.comment ?? null,
        linkCode: `BR-${selectedReservation.reservationId}`,
        createdAt: selectedReservation.createdAt,
        updatedAt: selectedReservation.createdAt,
        product: selectedReservation.product,
      }
    }
    
    // Если нет reservationId, но есть данные операции, создаем временный объект
    if (selectedReservation.type === 'reserve') {
      return {
        id: 0, // Временный ID
        productId: selectedReservation.productId,
        quantity: selectedReservation.quantity,
        customer: selectedReservation.customer ?? null,
        contact: selectedReservation.contact ?? null,
        status: 'active' as const,
        dueAt: selectedReservation.dueAt ?? null,
        comment: selectedReservation.comment ?? null,
        linkCode: `BR-TEMP-${selectedReservation.id}`,
        createdAt: selectedReservation.createdAt,
        updatedAt: selectedReservation.createdAt,
        product: selectedReservation.product,
      }
    }
    
    return null
  }, [selectedReservation, reservations])

  const filterProductId = Number(searchParams.get('productId')) || null
  const filteredOperations = useMemo(() => {
    if (!filterProductId) return operations
    return operations.filter((op) => op.productId === filterProductId)
  }, [operations, filterProductId])

  // Группируем операции по bundleId для визуального отображения
  const groupedOperations = useMemo(() => {
    const groups = new Map<number | null, typeof filteredOperations>()
    const ungrouped: typeof filteredOperations = []

    filteredOperations.forEach((op) => {
      if (op.bundleId) {
        if (!groups.has(op.bundleId)) {
          groups.set(op.bundleId, [])
        }
        groups.get(op.bundleId)!.push(op)
      } else {
        ungrouped.push(op)
      }
    })

    // Сортируем операции внутри групп по дате
    groups.forEach((ops) => {
      ops.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
    })

    // Объединяем в один массив: сначала группы, потом одиночные
    const result: Array<{ type: 'bundle' | 'single'; bundleId?: number; operations: typeof filteredOperations }> = []
    
    groups.forEach((ops, bundleId) => {
      result.push({ type: 'bundle', bundleId: bundleId ?? undefined, operations: ops })
    })

    ungrouped.forEach((op) => {
      result.push({ type: 'single', operations: [op] })
    })

    // Сортируем по дате самой ранней операции в группе/операции
    result.sort((a, b) => {
      const aDate = new Date(a.operations[0].occurredAt).getTime()
      const bDate = new Date(b.operations[0].occurredAt).getTime()
      return bDate - aDate // Новые сверху
    })

    return result
  }, [filteredOperations])

  const filterProduct = filterProductId
    ? products.find((p) => p.id === filterProductId) ?? null
    : null

  return (
    <>
      <Card>
        <CardHeader
          title="Журнал операций"
          action={
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-brand hover:text-brand dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand"
                onClick={() => {
                  setShowBundleOpForm(true)
                }}
              >
                <Plus size={14} />
                Комплект товаров
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-muted"
                onClick={() => {
                  setOperationPreset({})
                  setShowOpForm(true)
                }}
              >
                <Plus size={14} />
                Добавить операцию
              </button>
            </div>
          }
        />
        <CardContent>
          {filterProduct && (
            <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              <div>
                Фильтр по товару: <span className="font-semibold">{filterProduct.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setSearchParams({})}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <X size={14} />
                Сбросить
              </button>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-slate-500">Загрузка...</p>
          ) : groupedOperations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
              Журнал пуст. Добавьте приход, продажу или бронь, чтобы увидеть движение.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50/80 text-xs uppercase text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-left">Дата</th>
                      <th className="px-4 py-3 text-left">Оборудование</th>
                      <th className="px-4 py-3 text-left">Тип</th>
                      <th className="px-4 py-3 text-left">Кол-во</th>
                      <th className="px-4 py-3 text-left">Оплата</th>
                      <th className="px-4 py-3 text-left">Клиент</th>
                      <th className="px-4 py-3 text-left">Комментарий</th>
                      <th className="px-4 py-3 text-left">Комплект</th>
                      <th className="px-4 py-3 text-left">Бронь / Разрешение</th>
                      <th className="px-4 py-3 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {groupedOperations.map((group) => (
                      <>
                        {group.type === 'bundle' && group.operations[0]?.bundle && (
                          <tr
                            key={`bundle-header-${group.bundleId}`}
                            className="bg-blue-50/50 dark:bg-blue-500/10"
                          >
                            <td colSpan={10} className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <Package size={14} className="text-blue-600 dark:text-blue-400" />
                                <span className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                                  Комплект:
                                </span>
                                <span className="font-semibold text-blue-900 dark:text-blue-100">
                                  {group.operations[0].bundle.title || 'Без названия'}
                                </span>
                                {group.operations[0].bundle.customer && (
                                  <span className="text-xs text-blue-600 dark:text-blue-400">
                                    • {group.operations[0].bundle.customer}
                                  </span>
                                )}
                                <span className="ml-auto text-xs text-blue-600 dark:text-blue-400">
                                  {group.operations.length} позиций
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                        {group.operations.map((op) => (
                          <tr
                            key={op.id}
                            className={clsx(
                              'text-slate-700 dark:text-slate-200',
                              group.type === 'bundle' && 'bg-blue-50/30 dark:bg-blue-500/5',
                            )}
                          >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <CalendarClock size={14} />
                            {formatDate(op.occurredAt)}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                          {op.product.name}
                        </td>
                        <td className="px-4 py-3">
                          {op.type === 'reserve' ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setSelectedReservation(op)
                              }}
                              className={clsx(
                                'rounded-full px-3 py-1 text-xs font-semibold transition hover:scale-105 hover:shadow-md cursor-pointer',
                                typeColors[op.type] ?? 'bg-slate-100 text-slate-700',
                              )}
                              title="Нажмите, чтобы посмотреть детали бронирования"
                            >
                              {translateType(op.type)}
                            </button>
                          ) : (
                            <span
                              className={clsx(
                                'rounded-full px-3 py-1 text-xs font-semibold',
                                typeColors[op.type] ?? 'bg-slate-100 text-slate-700',
                              )}
                            >
                              {translateType(op.type)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                          {formatNumber(op.quantity)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={clsx(
                              'rounded-full px-3 py-1 text-xs font-semibold',
                              op.paid
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200',
                            )}
                          >
                            {op.paid ? 'Оплачено' : 'Не оплачено'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                          <div className="flex flex-col">
                            <span>{op.customer || '—'}</span>
                            {op.contact && (
                              <span className="text-xs text-slate-500 dark:text-slate-400">{op.contact}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                          {op.comment || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                          {op.bundle ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-200">
                              <Package size={12} />
                              {op.bundle.title || 'Комплект'}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                          <div className="flex flex-col gap-1">
                            {op.reservation ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/reservations?reservationId=${op.reservation?.id}`)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 underline decoration-dotted underline-offset-2 transition hover:text-blue-700 dark:text-blue-300"
                              >
                                Детали брони
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                            {op.permitNumber && (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                Разрешение: {op.permitNumber}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            aria-label="Удалить операцию"
                            onClick={() => {
                              setDeleteTarget(op)
                              setDeleteError(null)
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-rose-500/80 transition hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/20"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                        ))}
                      </>
                    ))}
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

      {deleteTarget && (
        <Modal
          title="Удалить операцию?"
          onClose={() => {
            if (deleting) return
            setDeleteTarget(null)
            setDeleteError(null)
          }}
          widthClass="max-w-md"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Вы действительно хотите удалить эту запись? Остатки на складе будут пересчитаны.
            </p>
            {deleteError && (
              <p className="text-sm font-semibold text-rose-600 dark:text-rose-300">{deleteError}</p>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                disabled={deleting}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!deleteTarget) return
                  setDeleteError(null)
                  setDeleting(true)
                  try {
                    await deleteOperation(deleteTarget.id)
                    setDeleteTarget(null)
                  } catch (error) {
                    const message = error instanceof Error ? error.message : 'Не удалось удалить запись'
                    setDeleteError(message)
                  } finally {
                    setDeleting(false)
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
                disabled={deleting}
              >
                {deleting && <span className="h-3 w-3 animate-ping rounded-full bg-white/70" />}
                Удалить
              </button>
            </div>
          </div>
        </Modal>
      )}

      {selectedReservation && reservationForModal && (
        <ReservationDetailsModal
          reservation={reservationForModal}
          onClose={() => setSelectedReservation(null)}
        />
      )}
    </>
  )
}

function translateType(type: string) {
  const map: Record<string, string> = {
    purchase: 'Приход',
    sale: 'Продажа',
    reserve: 'Бронь',
    reserve_release: 'Снятие брони',
    sale_from_reserve: 'Продажа из брони',
    ship_on_credit: 'Отгрузка в долг',
    close_debt: 'Закрытие долга',
    return: 'Возврат',
  }
  return map[type] ?? type
}
