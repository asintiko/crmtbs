import { Copy, ExternalLink, Calendar, User, Phone, Package, MessageSquare, Tag } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Modal } from '@/components/Modal'
import { formatDate, formatNumber } from '@/lib/formatters'
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

const statusLabels: Record<Reservation['status'], string> = {
  active: 'Активна',
  expired: 'Истекла',
  released: 'Снята',
  sold: 'Продана',
}

type ReservationDetailsModalProps = {
  reservation: Reservation | null
  onClose: () => void
}

export function ReservationDetailsModal({ reservation, onClose }: ReservationDetailsModalProps) {
  const navigate = useNavigate()

  if (!reservation) return null

  const isExpired =
    reservation.status === 'active' && reservation.dueAt && new Date(reservation.dueAt) < new Date()
  const derivedStatus = isExpired ? 'expired' : reservation.status
  const link = `${window.location.origin}${window.location.pathname}#/reservations?reservationId=${reservation.id}`

  const handleCopyLink = () => {
    navigator.clipboard.writeText(link)
  }

  const handleGoToReservations = () => {
    navigate(`/reservations?reservationId=${reservation.id}`)
    onClose()
  }

  return (
    <Modal title="Детали бронирования" onClose={onClose} widthClass="max-w-2xl">
      <div className="space-y-6">
        {/* Заголовок с товаром и статусом */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {reservation.product.name}
            </h3>
            {reservation.product.sku && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Артикул: {reservation.product.sku}
              </p>
            )}
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide ${statusTone[derivedStatus]}`}
          >
            {statusLabels[derivedStatus]}
          </span>
        </div>

        {/* Основная информация */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Клиент */}
          <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
            <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-500/20">
              <User size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Клиент
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                {reservation.customer || 'Не указан'}
              </p>
            </div>
          </div>

          {/* Контакт */}
          {reservation.contact && (
            <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
              <div className="rounded-full bg-emerald-100 p-2 dark:bg-emerald-500/20">
                <Phone size={18} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Контакт
                </p>
                <a
                  href={`tel:${reservation.contact}`}
                  className="mt-1 block text-sm font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  {reservation.contact}
                </a>
              </div>
            </div>
          )}

          {/* Количество */}
          <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
            <div className="rounded-full bg-purple-100 p-2 dark:bg-purple-500/20">
              <Package size={18} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Количество
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                {formatNumber(reservation.quantity)}
              </p>
            </div>
          </div>

          {/* Дата окончания */}
          {reservation.dueAt && (
            <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
              <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-500/20">
                <Calendar size={18} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Срок действия
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                  {formatDate(reservation.dueAt)}
                </p>
                {isExpired && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    Бронирование истекло
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Комментарий */}
        {reservation.comment && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
            <div className="mb-2 flex items-center gap-2">
              <MessageSquare size={16} className="text-slate-500 dark:text-slate-400" />
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Комментарий
              </p>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-200">{reservation.comment}</p>
          </div>
        )}

        {/* Код ссылки */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag size={16} className="text-slate-500 dark:text-slate-400" />
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Код бронирования
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-mono font-semibold text-slate-900 dark:bg-slate-900 dark:text-white">
              #{reservation.linkCode}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand"
          >
            <Copy size={16} />
            Скопировать ссылку на бронь
          </button>
        </div>

        {/* Метаданные */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <div>
            <span className="font-semibold">Создано:</span>{' '}
            {formatDate(reservation.createdAt)}
          </div>
          {reservation.updatedAt !== reservation.createdAt && (
            <div>
              <span className="font-semibold">Обновлено:</span>{' '}
              {formatDate(reservation.updatedAt)}
            </div>
          )}
        </div>

        {/* Действия */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Закрыть
          </button>
          <button
            type="button"
            onClick={handleGoToReservations}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-muted"
          >
            Открыть в бронированиях
            <ExternalLink size={16} />
          </button>
        </div>
      </div>
    </Modal>
  )
}

