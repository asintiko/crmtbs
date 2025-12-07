import type { ProductSummary } from '../shared/types'

export function searchProducts(products: ProductSummary[], query: string) {
  const normalized = query.trim().toLowerCase()
  const already = new Set<number>()

  if (!normalized.length) {
    return []
  }

  const results: Array<{ product: ProductSummary; match: string; viaAlias: boolean }> = []

  for (const product of products) {
    if (product.archived) continue

    if (product.name.toLowerCase().includes(normalized)) {
      results.push({ product, match: product.name, viaAlias: false })
      already.add(product.id)
      continue
    }

    const alias = product.aliases.find((a) => a.label.toLowerCase().includes(normalized))
    if (alias && !already.has(product.id)) {
      results.push({ product, match: alias.label, viaAlias: true })
      already.add(product.id)
    }
  }

  return results.slice(0, 8)
}
