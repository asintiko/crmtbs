import { useEffect, useState } from 'react'
import { Bell, Check, Copy, DownloadCloud, Folder, Info, MoonStar, SunMedium, RefreshCw, ExternalLink } from 'lucide-react'

import { Card, CardContent, CardHeader } from '@/components/Card'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ReminderForm } from '@/components/ReminderForm'
import { api } from '@/lib/api'
import type { AppPaths, UpdateInfo } from '@/shared/types'
import { useInventory } from '@/providers/InventoryProvider'
import { formatDate } from '@/lib/formatters'

export function SettingsPage() {
  const [paths, setPaths] = useState<AppPaths | null>(null)
  const [backupStatus, setBackupStatus] = useState<string | null>(null)
  const [showReminderForm, setShowReminderForm] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false)
  const { reminders, createReminder, updateReminder } = useInventory()

  useEffect(() => {
    api
      .getPaths()
      .then(setPaths)
      .catch(() => setPaths(null))
  }, [])

  const handleBackup = async () => {
    setBackupStatus('Создание резервной копии...')
    try {
      const result = await api.backupNow()
      setBackupStatus(`Сохранено: ${result.backupPath}`)
    } catch (error) {
      console.error(error)
      setBackupStatus('Ошибка при создании резервной копии')
    }
  }

  const handleSaveReminder = async (payload: Parameters<typeof createReminder>[0]) => {
    await createReminder?.(payload)
  }

  const handleDeleteReminder = async (id: number) => {
    await updateReminder?.({ id, done: true })
  }

  const handleCheckUpdates = async () => {
    setIsCheckingUpdates(true)
    try {
      const info = await api.checkForUpdates()
      setUpdateInfo(info)
    } catch (error) {
      console.error(error)
      setUpdateInfo({
        hasUpdate: false,
        currentVersion: '0.1.0',
      })
    } finally {
      setIsCheckingUpdates(false)
    }
  }

  const handleOpenReleaseUrl = async (url: string) => {
    try {
      await api.openReleaseUrl(url)
    } catch (error) {
      console.error('Ошибка при открытии URL:', error)
    }
  }

  // Фильтруем напоминания: сначала активные, потом выполненные
  const activeReminders = reminders.filter((r) => !r.done)
  const doneReminders = reminders.filter((r) => r.done)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Темы и контрастность" />
        <CardContent>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Темный/Светлый</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Весь UI построен на Tailwind + классы для переключения dark/light.
              </p>
            </div>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Резервные копии"
          action={
            <button
              type="button"
              onClick={handleBackup}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-muted"
            >
              <DownloadCloud size={16} />
              Сохранить сейчас
            </button>
          }
        />
        <CardContent>
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-800">
              <Info size={16} className="mt-1 text-blue-500" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Авто-бэкап</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  При закрытии приложения база копируется в папку Documents/InventoryBackups.
                </p>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                <Folder size={14} />
                Пути
              </div>
              <PathRow label="База" value={paths?.database ?? '—'} />
              <PathRow label="Бэкапы" value={paths?.backupsDir ?? '—'} />
            </div>

            {backupStatus && (
              <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <Check size={14} />
                {backupStatus}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Обновления"
          action={
            <button
              type="button"
              onClick={handleCheckUpdates}
              disabled={isCheckingUpdates}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-muted disabled:opacity-50"
            >
              <RefreshCw size={14} className={isCheckingUpdates ? 'animate-spin' : ''} />
              Проверить
            </button>
          }
        />
        <CardContent>
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            {updateInfo ? (
              <>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
                  <span className="font-semibold text-slate-900 dark:text-white">Текущая версия:</span>
                  <span className="text-slate-600 dark:text-slate-300">{updateInfo.currentVersion}</span>
                </div>
                {updateInfo.hasUpdate ? (
                  <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 dark:border-emerald-800 dark:bg-emerald-500/10">
                    <div className="flex items-center gap-2">
                      <Check size={16} className="text-emerald-600 dark:text-emerald-400" />
                      <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                        Доступно обновление {updateInfo.latestVersion}
                      </p>
                    </div>
                    {updateInfo.releaseNotes && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        {updateInfo.releaseNotes.substring(0, 200)}
                        {updateInfo.releaseNotes.length > 200 ? '...' : ''}
                      </p>
                    )}
                    {updateInfo.releaseUrl && (
                      <button
                        type="button"
                        onClick={() => handleOpenReleaseUrl(updateInfo.releaseUrl!)}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                      >
                        <ExternalLink size={14} />
                        Открыть на GitHub
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
                    <Check size={16} className="text-emerald-500" />
                    <p className="font-semibold text-slate-900 dark:text-white">У вас установлена последняя версия</p>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                Нажмите «Проверить», чтобы узнать о доступных обновлениях
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Политика офлайн" />
        <CardContent>
          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <p>• Все данные сохраняются в локальный SQLite файл, без внешних API.</p>
            <p>• Импорт из Excel будет доступен при первом запуске (модуль миграции).</p>
            <p>• Валидации: запрет удаления товаров с историей, предупреждения при отрицательных остатках.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Горячие переключатели" />
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <QuickToggle
              icon={<SunMedium size={16} />}
              label="Светлая тема"
              description="Подойдет для печатных форм и яркого света."
            />
            <QuickToggle
              icon={<MoonStar size={16} />}
              label="Темная тема"
              description="Снижает нагрузку на глаза, основной режим."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Напоминания (системные уведомления)"
          action={
            <button
              type="button"
              onClick={() => setShowReminderForm(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-muted"
            >
              <Bell size={14} />
              Добавить
            </button>
          }
        />
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-500/10 dark:text-blue-200">
              <p>
                <strong>Системные уведомления:</strong> Напоминания показываются через системные
                уведомления ПК в назначенное время. Проверка происходит каждую минуту.
              </p>
            </div>

            {activeReminders.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Активные ({activeReminders.length})
                </h3>
                {activeReminders.map((reminder) => {
                  const isOverdue = new Date(reminder.dueAt) < new Date()
                  return (
                    <div
                      key={reminder.id}
                      className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-2 w-2 rounded-full bg-amber-400" />
                          <span className="font-semibold">{reminder.title}</span>
                          {isOverdue && (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-600 dark:bg-rose-500/10 dark:text-rose-200">
                              Просрочено
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>{formatDate(reminder.dueAt)}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteReminder(reminder.id)}
                            className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 transition hover:border-rose-500 hover:text-rose-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-rose-500"
                          >
                            Готово
                          </button>
                        </div>
                      </div>
                      {reminder.message && (
                        <p className="text-xs text-slate-600 dark:text-slate-400">{reminder.message}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {doneReminders.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Выполненные ({doneReminders.length})
                </h3>
                {doneReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-600 opacity-75 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                        <span className="font-semibold line-through">{reminder.title}</span>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(reminder.dueAt)}
                      </span>
                    </div>
                    {reminder.message && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">{reminder.message}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {reminders.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Напоминаний нет. Нажмите «Добавить», чтобы создать новое.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {showReminderForm && (
        <ReminderForm
          onClose={() => setShowReminderForm(false)}
          onSave={handleSaveReminder}
        />
      )}
    </div>
  )
}

function PathRow({ label, value }: { label: string; value: string }) {
  const isCopyable = value && value !== '—'

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:bg-slate-900/60 dark:text-slate-200">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <span className="truncate">{value}</span>
        <button
          type="button"
          onClick={() => isCopyable && navigator.clipboard.writeText(value)}
          disabled={!isCopyable}
          className="rounded-md p-1 text-slate-500 transition hover:bg-slate-200 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Скопировать путь"
        >
          <Copy size={14} />
        </button>
      </div>
    </div>
  )
}

function QuickToggle({
  icon,
  label,
  description,
}: {
  icon: React.ReactNode
  label: string
  description: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
        <span className="text-brand">{icon}</span>
        {label}
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  )
}
