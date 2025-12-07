import { AlertTriangle, Loader2, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react'

import { Card, CardContent, CardHeader } from '@/components/Card'
import { useInventory } from '@/providers/InventoryProvider'
import { formatNumber } from '@/lib/formatters'

export function DashboardPage() {
  const { products, operations, dashboard, loading } = useInventory()

  const totalOnHand = products.reduce((acc, p) => acc + p.stock.onHand, 0)
  const totalDebt = products.reduce((acc, p) => acc + p.stock.debt, 0)
  const lowStock = dashboard?.lowStock ?? []

  const stats = [
    {
      label: 'Номенклатура',
      value: products.length,
      icon: ShieldCheck,
      tone: 'text-emerald-500 bg-emerald-500/10',
    },
    {
      label: 'Остаток на складе',
      value: totalOnHand,
      icon: TrendingUp,
      tone: 'text-blue-500 bg-blue-500/10',
    },
    {
      label: 'В брони',
      value: dashboard?.totalReserved ?? 0,
      icon: AlertTriangle,
      tone: 'text-amber-500 bg-amber-500/10',
    },
    {
      label: 'Долги клиентов',
      value: totalDebt,
      icon: TrendingDown,
      tone: 'text-rose-500 bg-rose-500/10',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="h-full">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{stat.label}</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
                    {formatNumber(stat.value)}
                  </p>
                </div>
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.tone}`}
                >
                  <Icon size={18} />
                </span>
              </div>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Товары заканчиваются"
            action={
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                Контроль min остатка
              </span>
            }
          />
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                Загрузка...
              </div>
            ) : lowStock.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Все товары выше минимального остатка.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {lowStock.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{item.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Доступно {formatNumber(item.stock.available)} / Минимум {item.minStock}
                      </p>
                    </div>
                    <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-500">
                      Внимание
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Активные долги" />
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                Загрузка...
              </div>
            ) : (dashboard?.activeDebts?.length ?? 0) === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Долгов у клиентов нет.
              </p>
            ) : (
              <div className="space-y-3">
                {dashboard?.activeDebts.map((debt) => (
                  <div
                    key={`${debt.customer}-${debt.productId}`}
                    className="rounded-xl border border-rose-100 bg-rose-50/70 px-3 py-2 dark:border-rose-500/30 dark:bg-rose-500/10"
                  >
                    <p className="text-sm font-semibold text-rose-600 dark:text-rose-200">
                      {debt.customer}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {debt.productName}: {formatNumber(debt.debt)} шт.
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Последние операции" />
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              Загрузка...
            </div>
          ) : operations.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Пока нет операций. Добавьте приход/продажу в журнале.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50/80 dark:bg-slate-900/60">
                    <tr className="text-left text-xs uppercase text-slate-500 dark:text-slate-400">
                      <th className="px-4 py-2">Дата</th>
                      <th className="px-4 py-2">Товар</th>
                      <th className="px-4 py-2">Тип</th>
                      <th className="px-4 py-2">Кол-во</th>
                      <th className="px-4 py-2">Комментарий</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {operations.slice(0, 6).map((op) => (
                      <tr key={op.id}>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {new Date(op.occurredAt).toLocaleDateString('ru-RU')}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                          {op.product.name}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {translateType(op.type)}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                          {formatNumber(op.quantity)}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {op.comment || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
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
