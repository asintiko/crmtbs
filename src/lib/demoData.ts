import type { DashboardSummary, OperationWithProduct, ProductSummary } from '../shared/types'

export const demoProducts: ProductSummary[] = [
  {
    id: 1,
    name: 'Hytera BD505',
    sku: 'BD505',
    minStock: 5,
    hasImportPermit: true,
    notes: 'Основная модель для аренды.',
    archived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    aliases: [
      { id: 1, productId: 1, label: 'BD505' },
      { id: 2, productId: 1, label: 'Рация Хайтера 505' },
    ],
    stock: {
      onHand: 12,
      reserved: 3,
      debt: 2,
      balance: 12,
      available: 9,
    },
  },
  {
    id: 2,
    name: 'Kenwood TK-3000',
    sku: 'TK3000',
    minStock: 8,
    hasImportPermit: false,
    notes: '',
    archived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    aliases: [{ id: 3, productId: 2, label: 'Кенвуд 3000' }],
    stock: {
      onHand: 6,
      reserved: 1,
      debt: 0,
      balance: 6,
      available: 5,
    },
  },
  {
    id: 3,
    name: 'Motorola DP1400',
    sku: 'DP1400',
    minStock: 4,
    hasImportPermit: true,
    notes: 'Поставки раз в квартал',
    archived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    aliases: [],
    stock: {
      onHand: 3,
      reserved: 0,
      debt: 1,
      balance: 3,
      available: 3,
    },
  },
]

export const demoOperations: OperationWithProduct[] = [
  {
    id: 1,
    productId: 1,
    type: 'purchase',
    quantity: 10,
    customer: null,
    comment: 'Поставка из Гуанчжоу',
    occurredAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    product: { id: 1, name: 'Hytera BD505', sku: 'BD505' },
  },
  {
    id: 2,
    productId: 2,
    type: 'sale',
    quantity: 2,
    customer: 'ООО Ритм',
    comment: 'Оплата на месте',
    occurredAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    product: { id: 2, name: 'Kenwood TK-3000', sku: 'TK3000' },
  },
  {
    id: 3,
    productId: 3,
    type: 'ship_on_credit',
    quantity: 1,
    customer: 'ТК Север',
    comment: 'Срок оплаты 10 дней',
    occurredAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    product: { id: 3, name: 'Motorola DP1400', sku: 'DP1400' },
  },
]

export const demoDashboard: DashboardSummary = {
  lowStock: demoProducts.filter((p) => p.stock.available < p.minStock),
  totalReserved: demoProducts.reduce((acc, p) => acc + p.stock.reserved, 0),
  activeDebts: [
    {
      customer: 'ТК Север',
      productId: 3,
      productName: 'Motorola DP1400',
      debt: 1,
    },
  ],
}
