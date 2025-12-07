import { useState } from 'react'
import { NotebookPen, Plus, Shield, Tags, Pen } from 'lucide-react'

import { Card, CardContent, CardHeader } from '@/components/Card'
import { ProductForm } from '@/components/ProductForm'
import { useInventory } from '@/providers/InventoryProvider'

export function CatalogPage() {
  const { products } = useInventory()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const editingProduct = editingId ? products.find((p) => p.id === editingId) ?? null : null

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
              Справочник
            </p>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Названия и синонимы
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-muted"
          >
            <Plus size={14} />
            Добавить товар
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {products.map((product) => (
            <Card key={product.id}>
              <CardHeader
                title={product.name}
                action={
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      Мин. остаток: {product.minStock}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(product.id)
                        setShowForm(true)
                      }}
                      className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-200"
                    >
                      <Pen size={12} />
                      Редактировать
                    </button>
                  </div>
                }
              />
              <CardContent>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <Tags size={14} />
                  <span className="font-semibold">Теги:</span>
                  {product.aliases.length > 0 ? (
                    product.aliases.map((alias) => (
                      <span
                        key={alias.id}
                        className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {alias.label}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">Нет тегов</span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  {product.sku && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      <NotebookPen size={14} />
                      SKU: {product.sku}
                    </span>
                  )}
                  {product.model && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      Модель: {product.model}
                    </span>
                  )}
                  <span
                    className={
                      product.hasImportPermit
                        ? 'inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'
                        : 'inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    }
                  >
                    <Shield size={14} />
                    {product.hasImportPermit ? 'Разрешение есть' : 'Нет разрешения'}
                  </span>
                  {product.archived && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-200 px-3 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      Архив
                    </span>
                  )}
                </div>

                {product.accessories && product.accessories.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-semibold">Аксессуары:</span>
                    {product.accessories.map((acc) => (
                      <span
                        key={acc.id}
                        className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {acc.accessoryName}
                      </span>
                    ))}
                  </div>
                )}

                {product.notes && (
                  <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                    {product.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {showForm && (
        <ProductForm
          onClose={() => {
            setShowForm(false)
            setEditingId(null)
          }}
          product={editingProduct ?? undefined}
          onCreated={() => {
            setShowForm(false)
            setEditingId(null)
          }}
        />
      )}
    </>
  )
}
