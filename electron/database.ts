import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

import type {
  DashboardSummary,
  NewProductPayload,
  OperationInput,
  OperationWithProduct,
  ProductAlias,
  ProductAccessory,
  ProductSummary,
  ProductWithAliases,
  Reservation,
  Reminder,
  UpdateProductPayload,
  StockSnapshot,
} from '../src/shared/types'

type ProductRow = {
  id: number
  name: string
  sku: string | null
  model: string | null
  min_stock: number
  has_import_permit: number
  notes: string | null
  archived: number
  created_at: string
  updated_at: string
}

type OperationRow = {
  id: number
  product_id: number
  type: string
  quantity: number
  customer: string | null
  contact: string | null
  permit_number: string | null
  paid: number | null
  reservation_id: number | null
  bundle_id: number | null
  due_at: string | null
  comment: string | null
  occurred_at: string
  created_at: string
  product_name?: string | null
  product_sku?: string | null
  bundle_title?: string | null
  bundle_customer?: string | null
  bundle_note?: string | null
  reservation_customer?: string | null
  reservation_contact?: string | null
  reservation_status?: string | null
  reservation_quantity?: number | null
  reservation_due_at?: string | null
  reservation_comment?: string | null
  reservation_link_code?: string | null
  reservation_created_at?: string | null
  reservation_updated_at?: string | null
}

type ReservationRow = {
  id: number
  product_id: number
  quantity: number
  customer: string | null
  contact: string | null
  status: string
  due_at: string | null
  comment: string | null
  link_code: string
  created_at: string
  updated_at: string
}

type ReminderRow = {
  id: number
  title: string
  message: string | null
  due_at: string
  done: number
  target_type: string | null
  target_id: number | null
  created_at: string
}

const emptyStock: StockSnapshot = {
  onHand: 0,
  reserved: 0,
  debt: 0,
  balance: 0,
  available: 0,
}

const allowedOperationTypes = [
  'purchase',
  'sale',
  'reserve',
  'reserve_release',
  'sale_from_reserve',
  'ship_on_credit',
  'close_debt',
  'return',
] as const

export class InventoryDatabase {
  private db: Database.Database

  constructor(private filePath: string) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    this.db = new Database(filePath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.migrate()
  }

  getPath() {
    return this.filePath
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sku TEXT,
        model TEXT,
        min_stock INTEGER DEFAULT 0,
        has_import_permit INTEGER DEFAULT 0,
        notes TEXT,
        archived INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS aliases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        label TEXT NOT NULL,
        FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS product_accessories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        accessory_id INTEGER NOT NULL,
        UNIQUE(product_id, accessory_id),
        FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY(accessory_id) REFERENCES products(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS bundles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        customer TEXT,
        note TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        customer TEXT,
        contact TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        due_at TEXT,
        comment TEXT,
        link_code TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS operations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        quantity REAL NOT NULL,
        customer TEXT,
        contact TEXT,
        permit_number TEXT,
        paid INTEGER DEFAULT 0,
        reservation_id INTEGER,
        bundle_id INTEGER,
        due_at TEXT,
        comment TEXT,
        occurred_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY(reservation_id) REFERENCES reservations(id) ON DELETE SET NULL,
        FOREIGN KEY(bundle_id) REFERENCES bundles(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        message TEXT,
        due_at TEXT NOT NULL,
        done INTEGER DEFAULT 0,
        target_type TEXT,
        target_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_operations_product_id ON operations(product_id);
      CREATE INDEX IF NOT EXISTS idx_aliases_product_id ON aliases(product_id);
      CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_at);
    `)

    const alterStatements = [
      "ALTER TABLE products ADD COLUMN model TEXT",
      "ALTER TABLE operations ADD COLUMN contact TEXT",
      "ALTER TABLE operations ADD COLUMN permit_number TEXT",
      "ALTER TABLE operations ADD COLUMN paid INTEGER DEFAULT 0",
      "ALTER TABLE operations ADD COLUMN reservation_id INTEGER",
      "ALTER TABLE operations ADD COLUMN bundle_id INTEGER",
      "ALTER TABLE operations ADD COLUMN due_at TEXT",
    ]

    for (const stmt of alterStatements) {
      try {
        this.db.prepare(stmt).run()
      } catch (error) {
        // ignore if column already exists
      }
    }

    const indexStatements = [
      'CREATE INDEX IF NOT EXISTS idx_operations_reservation ON operations(reservation_id)',
      'CREATE INDEX IF NOT EXISTS idx_operations_bundle ON operations(bundle_id)',
    ]

    for (const stmt of indexStatements) {
      try {
        this.db.prepare(stmt).run()
      } catch (error) {
        // ignore if index cannot be created
      }
    }
  }

  listProducts(): ProductSummary[] {
    const products = this.db
      .prepare('SELECT * FROM products ORDER BY archived ASC, name COLLATE NOCASE ASC')
      .all() as ProductRow[]

    const aliasesByProduct = this.loadAliases()
    const accessoriesByProduct = this.loadAccessories(products.map((p) => p.id))
    const stockByProduct = this.getStockByProduct(products.map((p) => p.id))

    return products.map((product) => {
      const mapped = this.mapProduct(product)
      const stock = stockByProduct[mapped.id] ?? emptyStock
      return {
        ...mapped,
        aliases: aliasesByProduct[mapped.id] ?? [],
        accessories: accessoriesByProduct[mapped.id] ?? [],
        stock,
      }
    })
  }

  createProduct(payload: NewProductPayload): ProductSummary {
    const now = new Date().toISOString()
    const name = payload.name.trim()

    if (!name) {
      throw new Error('Название товара обязательно')
    }

    const insert = this.db.prepare(`
      INSERT INTO products (name, sku, model, min_stock, has_import_permit, notes, archived, created_at, updated_at)
      VALUES (@name, @sku, @model, @min_stock, @has_import_permit, @notes, 0, @created_at, @updated_at)
    `)

    const result = insert.run({
      name,
      sku: payload.sku ?? null,
      model: payload.model?.trim() || null,
      min_stock: Math.max(0, payload.minStock ?? 0),
      has_import_permit: payload.hasImportPermit ? 1 : 0,
      notes: payload.notes ?? null,
      created_at: now,
      updated_at: now,
    })

    const productId = Number(result.lastInsertRowid)

    if (payload.aliases?.length) {
      const insertAlias = this.db.prepare(
        'INSERT INTO aliases (product_id, label) VALUES (@product_id, @label)',
      )
      const insertMany = this.db.transaction((aliases: string[]) => {
        for (const label of aliases) {
          if (label.trim()) {
            insertAlias.run({ product_id: productId, label: label.trim() })
          }
        }
      })
      insertMany(payload.aliases)
    }

    if (payload.accessoryIds?.length) {
      this.upsertAccessories(productId, payload.accessoryIds)
    }

    const created = this.db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as ProductRow
    return {
      ...this.mapProduct(created),
      aliases: this.loadAliases()[productId] ?? [],
      accessories: this.loadAccessories([productId])[productId] ?? [],
      stock: emptyStock,
    }
  }

  updateProduct(payload: UpdateProductPayload): ProductSummary {
    const product = this.db.prepare('SELECT * FROM products WHERE id = ?').get(payload.id) as
      | ProductRow
      | undefined

    if (!product) {
      throw new Error('Товар не найден')
    }

    const name = payload.name?.trim() ?? product.name
    if (!name) {
      throw new Error('Название товара обязательно')
    }

    const updatedAt = new Date().toISOString()
    const nextSku = payload.sku !== undefined ? payload.sku : product.sku
    const nextModel = payload.model !== undefined ? payload.model : product.model
    const nextNotes = payload.notes !== undefined ? payload.notes : product.notes
    const nextPermit = payload.hasImportPermit ?? Boolean(product.has_import_permit)
    const nextArchived = payload.archived ?? Boolean(product.archived)
    const updateStmt = this.db.prepare(`
      UPDATE products
      SET name = @name,
          sku = @sku,
          model = @model,
          min_stock = @min_stock,
          has_import_permit = @has_import_permit,
          notes = @notes,
          archived = @archived,
          updated_at = @updated_at
      WHERE id = @id
    `)

    updateStmt.run({
      id: payload.id,
      name,
      sku: nextSku,
      model: nextModel,
      min_stock: Math.max(0, payload.minStock ?? product.min_stock ?? 0),
      has_import_permit: nextPermit ? 1 : 0,
      notes: nextNotes,
      archived: nextArchived ? 1 : 0,
      updated_at: updatedAt,
    })

    if (payload.aliases) {
      const removeStmt = this.db.prepare('DELETE FROM aliases WHERE product_id = ?')
      const insertAlias = this.db.prepare(
        'INSERT INTO aliases (product_id, label) VALUES (@product_id, @label)',
      )
      const transaction = this.db.transaction((aliases: string[]) => {
        removeStmt.run(payload.id)
        for (const label of aliases) {
          const trimmed = label.trim()
          if (trimmed) {
            insertAlias.run({ product_id: payload.id, label: trimmed })
          }
        }
      })
      transaction(payload.aliases)
    }

    if (payload.accessoryIds) {
      this.upsertAccessories(payload.id, payload.accessoryIds)
    }

    const updated = this.db.prepare('SELECT * FROM products WHERE id = ?').get(payload.id) as ProductRow
    return {
      ...this.mapProduct(updated),
      aliases: this.loadAliases()[payload.id] ?? [],
      accessories: this.loadAccessories([payload.id])[payload.id] ?? [],
      stock: this.getStockByProduct([payload.id])[payload.id] ?? emptyStock,
    }
  }

  listOperations(): OperationWithProduct[] {
    const rows = this.db
      .prepare(
        `
        SELECT
          o.*,
          p.name as product_name,
          p.sku as product_sku,
          b.title as bundle_title,
          b.customer as bundle_customer,
          b.note as bundle_note,
          r.customer as reservation_customer,
          r.contact as reservation_contact,
          r.status as reservation_status,
          r.quantity as reservation_quantity,
          r.due_at as reservation_due_at,
          r.comment as reservation_comment,
          r.link_code as reservation_link_code,
          r.created_at as reservation_created_at,
          r.updated_at as reservation_updated_at
        FROM operations o
        LEFT JOIN products p ON p.id = o.product_id
        LEFT JOIN bundles b ON b.id = o.bundle_id
        LEFT JOIN reservations r ON r.id = o.reservation_id
        ORDER BY datetime(o.occurred_at) DESC, o.id DESC
      `,
      )
      .all() as OperationRow[]

    return rows.map((row) => this.mapOperation(row))
  }

  createOperation(payload: OperationInput): OperationWithProduct {
    const product = this.db.prepare('SELECT * FROM products WHERE id = ?').get(payload.productId) as
      | ProductRow
      | undefined

    if (!product) {
      throw new Error('Товар не найден')
    }

    if (!allowedOperationTypes.includes(payload.type)) {
      throw new Error('Неизвестный тип операции')
    }

    if (payload.quantity <= 0) {
      throw new Error('Количество должно быть больше 0')
    }

    const customer = payload.customer?.trim() ?? ''
    if (['ship_on_credit', 'close_debt'].includes(payload.type) && !customer) {
      throw new Error('Укажите клиента для операций с долгом')
    }

    if (payload.type === 'close_debt') {
      const currentDebt = this.getCustomerDebt(payload.productId, customer)
      if (currentDebt <= 0) {
        throw new Error('Долг для этого клиента отсутствует')
      }
      if (payload.quantity > currentDebt) {
        throw new Error('Сумма погашения превышает остаток долга')
      }
    }

    const contact = payload.contact?.trim() ?? ''
    let reservationId = payload.reservationId ?? null
    const bundleTitle = payload.bundleTitle?.trim() || null
    let bundleId = payload.bundleId ?? null
    const dueAt = payload.dueAt ?? null
    const permitNumber = payload.permitNumber?.trim() || null
    const paid =
      payload.paid ??
      (['sale', 'sale_from_reserve', 'close_debt'].includes(payload.type)
        ? true
        : payload.type === 'ship_on_credit'
          ? false
          : false)

    const occurred = payload.occurredAt ?? new Date().toISOString()
    const now = occurred

    if (payload.type === 'reserve') {
      const linkCode = `BR-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`
      const insertReserve = this.db.prepare(`
        INSERT INTO reservations (product_id, quantity, customer, contact, status, due_at, comment, link_code, created_at, updated_at)
        VALUES (@product_id, @quantity, @customer, @contact, 'active', @due_at, @comment, @link_code, @created_at, @updated_at)
      `)
      const resResult = insertReserve.run({
        product_id: payload.productId,
        quantity: payload.quantity,
        customer: customer || null,
        contact: contact || null,
        due_at: dueAt,
        comment: payload.comment ?? null,
        link_code: linkCode,
        created_at: now,
        updated_at: now,
      })
      reservationId = Number(resResult.lastInsertRowid)
    }

    if (['reserve_release', 'sale_from_reserve'].includes(payload.type)) {
      if (!reservationId) {
        throw new Error('Укажите бронь для изменения статуса')
      }
      const reservation = this.db
        .prepare('SELECT * FROM reservations WHERE id = ?')
        .get(reservationId) as ReservationRow | undefined
      if (!reservation) {
        throw new Error('Бронь не найдена')
      }
      const nextStatus = payload.type === 'sale_from_reserve' ? 'sold' : 'released'
      this.db
        .prepare('UPDATE reservations SET status = ?, updated_at = ? WHERE id = ?')
        .run(nextStatus, now, reservationId)
    }

    if (!bundleId && bundleTitle) {
      const bundleInsert = this.db.prepare(
        'INSERT INTO bundles (title, customer, note, created_at) VALUES (@title, @customer, @note, @created_at)',
      )
      const bundleResult = bundleInsert.run({
        title: bundleTitle,
        customer: customer || contact || null,
        note: payload.comment ?? null,
        created_at: now,
      })
      bundleId = Number(bundleResult.lastInsertRowid)
    }

    const insert = this.db.prepare(`
      INSERT INTO operations (product_id, type, quantity, customer, contact, permit_number, paid, reservation_id, bundle_id, due_at, comment, occurred_at)
      VALUES (@product_id, @type, @quantity, @customer, @contact, @permit_number, @paid, @reservation_id, @bundle_id, @due_at, @comment, @occurred_at)
    `)

    const result = insert.run({
      product_id: payload.productId,
      type: payload.type,
      quantity: payload.quantity,
      customer: customer || null,
      contact: contact || null,
      permit_number: permitNumber,
      paid: paid ? 1 : 0,
      reservation_id: reservationId,
      bundle_id: bundleId,
      due_at: dueAt,
      comment: payload.comment ?? null,
      occurred_at: occurred,
    })

    this.db.prepare('UPDATE products SET updated_at = ? WHERE id = ?').run(occurred, payload.productId)

    const created = this.db
      .prepare(
        `
        SELECT
          o.*,
          p.name as product_name,
          p.sku as product_sku,
          b.title as bundle_title,
          b.customer as bundle_customer,
          b.note as bundle_note,
          r.customer as reservation_customer,
          r.contact as reservation_contact,
          r.status as reservation_status,
          r.quantity as reservation_quantity,
          r.due_at as reservation_due_at,
          r.comment as reservation_comment,
          r.link_code as reservation_link_code,
          r.created_at as reservation_created_at,
          r.updated_at as reservation_updated_at
        FROM operations o
        LEFT JOIN products p ON p.id = o.product_id
        LEFT JOIN bundles b ON b.id = o.bundle_id
        LEFT JOIN reservations r ON r.id = o.reservation_id
        WHERE o.id = ?
      `,
      )
      .get(result.lastInsertRowid) as OperationRow

    const operationResult = this.mapOperation(created)

    // Автоматическое создание напоминаний
    // 1. Если создана бронь с датой окончания - напомнить за день до
    if (payload.type === 'reserve' && reservationId && dueAt) {
      const dueDate = new Date(dueAt)
      const reminderDate = new Date(dueDate)
      reminderDate.setDate(reminderDate.getDate() - 1) // За день до окончания
      
      // Создаем напоминание только если дата в будущем
      if (reminderDate > new Date()) {
        const reminderTitle = `Бронь истекает: ${product?.name ?? 'Товар'}`
        const reminderMessage = `Бронь #${reservationId} (${customer || 'Клиент'}) истекает завтра. ${contact ? `Контакт: ${contact}` : ''}`
        
        this.createReminder({
          title: reminderTitle,
          message: reminderMessage,
          dueAt: reminderDate.toISOString(),
          targetType: 'reservation',
          targetId: reservationId,
        })
      }
    }

    // 2. Если отгрузка в долг - напомнить через 7 дней проверить оплату
    if (payload.type === 'ship_on_credit' && customer) {
      const reminderDate = new Date()
      reminderDate.setDate(reminderDate.getDate() + 7) // Через 7 дней
      
      const reminderTitle = `Проверить оплату долга: ${customer}`
      const reminderMessage = `Отгружено в долг: ${product?.name ?? 'Товар'} (${payload.quantity} шт.). Клиент: ${customer}. ${contact ? `Контакт: ${contact}` : ''}`
      
      this.createReminder({
        title: reminderTitle,
        message: reminderMessage,
        dueAt: reminderDate.toISOString(),
        targetType: 'operation',
        targetId: operationResult.id,
      })
    }

    return operationResult
  }

  deleteOperation(id: number): void {
    const existing = this.db.prepare('SELECT * FROM operations WHERE id = ?').get(id) as
      | OperationRow
      | undefined
    if (!existing) return

    this.db.prepare('DELETE FROM operations WHERE id = ?').run(id)
    this.db
      .prepare('UPDATE products SET updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), existing.product_id)
  }

  deleteProduct(id: number): void {
    const product = this.db.prepare('SELECT * FROM products WHERE id = ?').get(id) as
      | ProductRow
      | undefined
    if (!product) return

    const { count } = this.db
      .prepare('SELECT COUNT(*) as count FROM operations WHERE product_id = ?')
      .get(id) as { count: number }

    if (count > 0) {
      throw new Error('Товар используется в операциях и не может быть удален')
    }

    const remove = this.db.transaction((productId: number) => {
      this.db.prepare('DELETE FROM aliases WHERE product_id = ?').run(productId)
      this.db.prepare('DELETE FROM products WHERE id = ?').run(productId)
    })
    remove(id)
  }

  getDashboard(): DashboardSummary {
    const products = this.listProducts()
    const lowStock = products.filter(
      (p) => !p.archived && p.minStock > 0 && p.stock.available < p.minStock,
    )
    const totalReserved = products.reduce((sum, p) => sum + p.stock.reserved, 0)

    const debtRows =
      (this.db
        .prepare(
          `
        SELECT product_id as productId, customer, SUM(
          CASE
            WHEN type = 'ship_on_credit' THEN quantity
            WHEN type = 'close_debt' THEN -quantity
            ELSE 0
          END
        ) as debt
        FROM operations
        WHERE customer IS NOT NULL
        GROUP BY product_id, customer
        HAVING debt > 0
      `,
        )
        .all() as Array<{ productId: number; customer: string; debt: number }>) ?? []

    const productMap = new Map(products.map((p) => [p.id, p]))

    return {
      lowStock,
      totalReserved,
      activeDebts: debtRows.map((row) => ({
        productId: row.productId,
        customer: row.customer,
        debt: row.debt,
        productName: productMap.get(row.productId)?.name ?? 'Неизвестно',
      })),
    }
  }

  listReservations(): Reservation[] {
    const rows =
      (this.db
        .prepare(
          `
        SELECT r.*, p.name as product_name, p.sku as product_sku
        FROM reservations r
        LEFT JOIN products p ON p.id = r.product_id
        ORDER BY datetime(r.due_at) ASC, r.id DESC
      `,
        )
        .all() as Array<ReservationRow & { product_name: string; product_sku: string | null }>) ?? []

    return rows.map((row) => {
      const status =
        row.status === 'active' && row.due_at && new Date(row.due_at) < new Date()
          ? ('expired' as const)
          : (row.status as Reservation['status'])

      return {
        id: row.id,
        productId: row.product_id,
        quantity: row.quantity,
        customer: row.customer ?? undefined,
        contact: row.contact ?? undefined,
        status,
        dueAt: row.due_at ?? undefined,
        comment: row.comment ?? undefined,
        linkCode: row.link_code,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        product: {
          id: row.product_id,
          name: row.product_name ?? 'Товар',
          sku: row.product_sku ?? undefined,
        },
      }
    })
  }

  updateReservation(payload: Partial<Reservation> & { id: number }): Reservation {
    const existing = this.db
      .prepare('SELECT * FROM reservations WHERE id = ?')
      .get(payload.id) as ReservationRow | undefined
    if (!existing) {
      throw new Error('Бронь не найдена')
    }

    const nextStatus = payload.status ?? existing.status
    const updateStmt = this.db.prepare(`
      UPDATE reservations
      SET customer = @customer,
          contact = @contact,
          status = @status,
          due_at = @due_at,
          comment = @comment,
          updated_at = @updated_at
      WHERE id = @id
    `)

    const updatedAt = new Date().toISOString()
    updateStmt.run({
      id: payload.id,
      customer: payload.customer ?? existing.customer,
      contact: payload.contact ?? existing.contact,
      status: nextStatus,
      due_at: payload.dueAt ?? existing.due_at,
      comment: payload.comment ?? existing.comment,
      updated_at: updatedAt,
    })

    const row = this.db
      .prepare(
        `
        SELECT r.*, p.name as product_name, p.sku as product_sku
        FROM reservations r
        LEFT JOIN products p ON p.id = r.product_id
        WHERE r.id = ?
      `,
      )
      .get(payload.id) as (ReservationRow & { product_name: string; product_sku: string | null }) | undefined

    if (!row) {
      throw new Error('Не удалось обновить бронь')
    }

    const status =
      row.status === 'active' && row.due_at && new Date(row.due_at) < new Date()
        ? ('expired' as const)
        : (row.status as Reservation['status'])

    return {
      id: row.id,
      productId: row.product_id,
      quantity: row.quantity,
      customer: row.customer ?? undefined,
      contact: row.contact ?? undefined,
      status,
      dueAt: row.due_at ?? undefined,
      comment: row.comment ?? undefined,
      linkCode: row.link_code,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      product: {
        id: row.product_id,
        name: row.product_name ?? 'Товар',
        sku: row.product_sku ?? undefined,
      },
    }
  }

  listReminders(): Reminder[] {
    const rows =
      (this.db
        .prepare('SELECT * FROM reminders ORDER BY done ASC, datetime(due_at) ASC')
        .all() as ReminderRow[]) ?? []

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      message: row.message ?? undefined,
      dueAt: row.due_at,
      done: Boolean(row.done),
      targetType: (row.target_type as Reminder['targetType']) ?? null,
      targetId: row.target_id ?? null,
      createdAt: row.created_at,
    }))
  }

  createReminder(payload: Omit<Reminder, 'id' | 'done' | 'createdAt'>): Reminder {
    const insert = this.db.prepare(`
      INSERT INTO reminders (title, message, due_at, done, target_type, target_id, created_at)
      VALUES (@title, @message, @due_at, 0, @target_type, @target_id, @created_at)
    `)
    const now = new Date().toISOString()
    const result = insert.run({
      title: payload.title,
      message: payload.message ?? null,
      due_at: payload.dueAt,
      target_type: payload.targetType ?? null,
      target_id: payload.targetId ?? null,
      created_at: now,
    })

    return {
      id: Number(result.lastInsertRowid),
      title: payload.title,
      message: payload.message ?? undefined,
      dueAt: payload.dueAt,
      done: false,
      targetType: payload.targetType ?? null,
      targetId: payload.targetId ?? null,
      createdAt: now,
    }
  }

  updateReminder(payload: Partial<Reminder> & { id: number; done?: boolean }): Reminder {
    const existing = this.db
      .prepare('SELECT * FROM reminders WHERE id = ?')
      .get(payload.id) as ReminderRow | undefined
    if (!existing) {
      throw new Error('Напоминание не найдено')
    }

    const update = this.db.prepare(`
      UPDATE reminders
      SET title = @title,
          message = @message,
      due_at = @due_at,
      done = @done,
      target_type = @target_type,
      target_id = @target_id
      WHERE id = @id
    `)

    update.run({
      id: payload.id,
      title: payload.title ?? existing.title,
      message: payload.message ?? existing.message,
      due_at: payload.dueAt ?? existing.due_at,
      done: (payload.done ?? Boolean(existing.done)) ? 1 : 0,
      target_type: payload.targetType ?? existing.target_type,
      target_id: payload.targetId ?? existing.target_id,
    })

    const updated = this.db
      .prepare('SELECT * FROM reminders WHERE id = ?')
      .get(payload.id) as ReminderRow

    return {
      id: updated.id,
      title: updated.title,
      message: updated.message ?? undefined,
      dueAt: updated.due_at,
      done: Boolean(updated.done),
      targetType: (updated.target_type as Reminder['targetType']) ?? null,
      targetId: updated.target_id ?? null,
      createdAt: updated.created_at,
    }
  }

  private loadAliases(): Record<number, ProductAlias[]> {
    const rows = this.db.prepare('SELECT * FROM aliases').all() as Array<{
      id: number
      product_id: number
      label: string
    }>

    return rows.reduce<Record<number, ProductAlias[]>>((acc, row) => {
      acc[row.product_id] = acc[row.product_id] ?? []
      acc[row.product_id].push({
        id: row.id,
        productId: row.product_id,
        label: row.label,
      })
      return acc
    }, {})
  }

  private loadAccessories(productIds?: number[]): Record<number, ProductAccessory[]> {
    const filter = productIds?.length ? `WHERE pa.product_id IN (${productIds.map(() => '?').join(',')})` : ''
    const params = productIds?.length ? productIds : []
    const rows =
      (this.db
        .prepare(
          `
        SELECT pa.id, pa.product_id, pa.accessory_id, p.name as accessory_name, p.sku as accessory_sku
        FROM product_accessories pa
        LEFT JOIN products p ON p.id = pa.accessory_id
        ${filter}
      `,
        )
        .all(...params) as Array<{
          id: number
          product_id: number
          accessory_id: number
          accessory_name: string
          accessory_sku: string | null
        }>) ?? []

    return rows.reduce<Record<number, ProductAccessory[]>>((acc, row) => {
      acc[row.product_id] = acc[row.product_id] ?? []
      acc[row.product_id].push({
        id: row.id,
        productId: row.product_id,
        accessoryId: row.accessory_id,
        accessoryName: row.accessory_name ?? 'Аксессуар',
        accessorySku: row.accessory_sku,
      })
      return acc
    }, {})
  }

  private upsertAccessories(productId: number, accessoryIds: number[]) {
    const uniqueIds = Array.from(new Set(accessoryIds.filter((id) => id !== productId)))
    const removeStmt = this.db.prepare('DELETE FROM product_accessories WHERE product_id = ?')
    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO product_accessories (product_id, accessory_id) VALUES (@product_id, @accessory_id)
    `)

    const tx = this.db.transaction(() => {
      removeStmt.run(productId)
      for (const accessoryId of uniqueIds) {
        insertStmt.run({ product_id: productId, accessory_id: accessoryId })
      }
    })

    tx()
  }

  private mapProduct(row: ProductRow): ProductWithAliases {
    return {
      id: row.id,
      name: row.name,
      sku: row.sku,
      model: row.model,
      minStock: row.min_stock ?? 0,
      hasImportPermit: Boolean(row.has_import_permit),
      notes: row.notes,
      archived: Boolean(row.archived),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      aliases: [],
      accessories: [],
    }
  }

  private mapOperation(row: OperationRow): OperationWithProduct {
    const reservationStatus =
      row.reservation_status === 'active' && row.reservation_due_at
        ? new Date(row.reservation_due_at) < new Date()
          ? ('expired' as const)
          : (row.reservation_status as Reservation['status'])
        : (row.reservation_status as Reservation['status'] | undefined)

    return {
      id: row.id,
      productId: row.product_id,
      type: row.type as OperationWithProduct['type'],
      quantity: row.quantity,
      customer: row.customer,
      contact: row.contact,
      permitNumber: row.permit_number ?? undefined,
      paid: Boolean(row.paid),
      reservationId: row.reservation_id ?? null,
      bundleId: row.bundle_id ?? null,
      dueAt: row.due_at ?? null,
      comment: row.comment,
      occurredAt: row.occurred_at,
      createdAt: row.created_at,
      bundle: row.bundle_id
        ? {
            id: row.bundle_id,
            title: row.bundle_title,
            customer: row.bundle_customer,
            note: row.bundle_note,
            createdAt: row.created_at,
          }
        : null,
      reservation: row.reservation_id
        ? {
            id: row.reservation_id,
            productId: row.product_id,
            quantity: row.reservation_quantity ?? row.quantity,
            customer: row.reservation_customer,
            contact: row.reservation_contact,
            status: (reservationStatus ?? 'active') as Reservation['status'],
            dueAt: row.reservation_due_at,
            comment: row.reservation_comment,
            linkCode: row.reservation_link_code ?? '',
            createdAt: row.reservation_created_at ?? row.created_at,
            updatedAt: row.reservation_updated_at ?? row.created_at,
            product: {
              id: row.product_id,
              name: row.product_name ?? 'Товар',
              sku: row.product_sku ?? undefined,
            },
          }
        : null,
      product: {
        id: row.product_id,
        name: row.product_name ?? 'Товар',
        sku: row.product_sku ?? undefined,
      },
    }
  }

  private getCustomerDebt(productId: number, customer: string) {
    if (!customer) return 0

    const row = this.db
      .prepare(
        `
      SELECT SUM(
        CASE
          WHEN type = 'ship_on_credit' THEN quantity
          WHEN type = 'close_debt' THEN -quantity
          ELSE 0
        END
      ) as debt
      FROM operations
      WHERE product_id = ? AND lower(trim(customer)) = lower(trim(?))
    `,
      )
      .get(productId, customer) as { debt: number | null } | undefined

    return row?.debt ?? 0
  }

  private getStockByProduct(productIds?: number[]): Record<number, StockSnapshot> {
    const filter = productIds?.length ? `WHERE product_id IN (${productIds.map(() => '?').join(',')})` : ''
    const params = productIds?.length ? productIds : []
    const rows =
      (this.db
        .prepare(
          `
        SELECT
          product_id as productId,
          SUM(
            CASE
              WHEN type = 'purchase' THEN quantity
              WHEN type = 'return' THEN quantity
              WHEN type = 'sale' THEN -quantity
              WHEN type = 'sale_from_reserve' THEN -quantity
              WHEN type = 'ship_on_credit' THEN -quantity
              ELSE 0
            END
          ) as onHand,
          SUM(
            CASE
              WHEN type = 'reserve' THEN quantity
              WHEN type = 'reserve_release' THEN -quantity
              WHEN type = 'sale_from_reserve' THEN -quantity
              ELSE 0
            END
          ) as reserved,
          SUM(
            CASE
              WHEN type = 'ship_on_credit' THEN quantity
              WHEN type = 'close_debt' THEN -quantity
              ELSE 0
            END
          ) as debt
        FROM operations
        ${filter}
        GROUP BY product_id
      `,
        )
        .all(...params)) ?? []

    const stockByProduct: Record<number, StockSnapshot> = {}

    for (const row of rows as Array<{ productId: number; onHand: number; reserved: number; debt: number }>) {
      const onHand = row.onHand ?? 0
      const reserved = row.reserved ?? 0
      const debt = row.debt ?? 0

      stockByProduct[row.productId] = {
        onHand,
        reserved,
        debt,
        balance: onHand,
        available: onHand - reserved,
      }
    }

    if (productIds?.length) {
      for (const id of productIds) {
        stockByProduct[id] = stockByProduct[id] ?? { ...emptyStock }
      }
    }

    return stockByProduct
  }
}
