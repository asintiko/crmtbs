import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Clock, Copy, Shield, XCircle } from 'lucide-react'

import { Card, CardContent, CardHeader } from '@/components/Card'
import { formatDate, formatNumber } from '@/lib/formatters'
import { useInventory } from '@/providers/InventoryProvider'
import type { Reservation } from '@/shared/types'

const statusTone: Record<Reservation['status'], string> = {
  active:
    'bg-blue-100 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-200 dark:ring-blue-500/40',
  expired:
    'bg-amber-100 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/40',
  released:
    'bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700',
  sold:
    'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/40',
}

export function ReservationsPage() {
  const { reservations, loading, createOperation } = useInventory()
  const [searchParams] = useSearchParams()
  const [busyId, setBusyId] = useState<number | null>(null)
  const filterProductId = Number(searchParams.get('productId')) || null

  const filtered = useMemo(() => {
    if (!filterProductId) return reservations
    return reservations.filter((r) => r.productId === filterProductId)
  }, [filterProductId, reservations])

  const handleAction = async (reservation: Reservation, action: 'release' | 'sell') => {
    setBusyId(reservation.id)
    try {
      await createOperation({
        productId: reservation.productId,
        type: action === 'sell' ? 'sale_from_reserve' : 'reserve_release',
        quantity: reservation.quantity,
        customer: reservation.customer,
        contact: reservation.contact,
        reservationId: reservation.id,
        comment:
          action === 'sell'
            ? `Продажа из брони ${reservation.linkCode}`
            : `Снятие брони ${reservation.linkCode}`,
      })
    } catch (error) {
      console.error(error)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
            Брони
          </p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Детали и статусы бронирований
          </h2>
        </div>
        {filterProductId && (
          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            Фильтр по товару ID: {filterProductId}
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Загрузка...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
          Брони не найдены.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((reservation) => {
            const isExpired =
              reservation.status === 'active' &&
              reservation.dueAt &&
              new Date(reservation.dueAt) < new Date()
            const derivedStatus = isExpired ? 'expired' : reservation.status
            const link = `#/reservations?reservationId=${reservation.id}`

            return (
              <Card key={reservation.id}>
                <CardHeader
                  title={reservation.product.name}
                  action={
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusTone[derivedStatus]}`}
                    >
                      {derivedStatus === 'active' && <Shield size={12} />}
                      {derivedStatus === 'expired' && <Clock size={12} />}
                      {derivedStatus === 'sold' && <BadgeCheck size={12} />}
                      {derivedStatus === 'released' && <XCircle size={12} />}
                      {derivedStatus}
                    </span>
                  }
                />
                <CardContent>
                  <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">Количество:</span>
                      {formatNumber(reservation.quantity)}
                      <ArrowRight size={12} />
                      <span>{reservation.customer || '— клиент не указан'}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">Срок:</span>
                      {reservation.dueAt ? formatDate(reservation.dueAt) : '—'}
                    </div>
                    {reservation.contact && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Контакт: {reservation.contact}
                      </div>
                    )}
                    {reservation.comment && (
                      <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                        {reservation.comment}
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Ссылка:</span>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(link)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand"
                        >
                          <Copy size={12} />
                          Скопировать
                        </button>
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        #{reservation.linkCode}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleAction(reservation, 'sell')}
                      disabled={busyId === reservation.id || reservation.status === 'sold'}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                    >
                      Продать
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction(reservation, 'release')}
                      disabled={busyId === reservation.id || reservation.status === 'released'}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand"
                    >
                      Снять бронь
                    </button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
