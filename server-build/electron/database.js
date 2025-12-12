import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
const emptyStock = {
    onHand: 0,
    reserved: 0,
    debt: 0,
    balance: 0,
    available: 0,
};
const allowedOperationTypes = [
    'purchase',
    'sale',
    'reserve',
    'reserve_release',
    'sale_from_reserve',
    'ship_on_credit',
    'close_debt',
    'return',
];
export class InventoryDatabase {
    constructor(filePath) {
        this.filePath = filePath;
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        this.db = new Database(filePath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
        this.migrate();
    }
    getPath() {
        return this.filePath;
    }
    migrate() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        email TEXT,
        google_drive_folder_id TEXT,
        google_drive_client_id TEXT,
        google_drive_client_secret TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL DEFAULT 1,
        name TEXT NOT NULL,
        sku TEXT,
        model TEXT,
        min_stock INTEGER DEFAULT 0,
        has_import_permit INTEGER DEFAULT 0,
        notes TEXT,
        archived INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
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
        user_id INTEGER NOT NULL DEFAULT 1,
        title TEXT,
        customer TEXT,
        note TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL DEFAULT 1,
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
        FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS operations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL DEFAULT 1,
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
        FOREIGN KEY(bundle_id) REFERENCES bundles(id) ON DELETE SET NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL DEFAULT 1,
        title TEXT NOT NULL,
        message TEXT,
        due_at TEXT NOT NULL,
        done INTEGER DEFAULT 0,
        target_type TEXT,
        target_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_operations_product_id ON operations(product_id);
      CREATE INDEX IF NOT EXISTS idx_aliases_product_id ON aliases(product_id);
      CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_at);
      CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id);
      CREATE INDEX IF NOT EXISTS idx_operations_user ON operations(user_id);
      CREATE INDEX IF NOT EXISTS idx_reservations_user ON reservations(user_id);
      CREATE INDEX IF NOT EXISTS idx_bundles_user ON bundles(user_id);
      CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id);
    `);
        const alterStatements = [
            "ALTER TABLE products ADD COLUMN model TEXT",
            "ALTER TABLE operations ADD COLUMN contact TEXT",
            "ALTER TABLE operations ADD COLUMN permit_number TEXT",
            "ALTER TABLE operations ADD COLUMN paid INTEGER DEFAULT 0",
            "ALTER TABLE operations ADD COLUMN reservation_id INTEGER",
            "ALTER TABLE operations ADD COLUMN bundle_id INTEGER",
            "ALTER TABLE operations ADD COLUMN due_at TEXT",
            "ALTER TABLE products ADD COLUMN user_id INTEGER DEFAULT 1",
            "ALTER TABLE bundles ADD COLUMN user_id INTEGER DEFAULT 1",
            "ALTER TABLE reservations ADD COLUMN user_id INTEGER DEFAULT 1",
            "ALTER TABLE operations ADD COLUMN user_id INTEGER DEFAULT 1",
            "ALTER TABLE reminders ADD COLUMN user_id INTEGER DEFAULT 1",
            "ALTER TABLE users ADD COLUMN google_drive_folder_id TEXT",
            "ALTER TABLE users ADD COLUMN google_drive_client_id TEXT",
            "ALTER TABLE users ADD COLUMN google_drive_client_secret TEXT",
        ];
        for (const stmt of alterStatements) {
            try {
                this.db.prepare(stmt).run();
            }
            catch (error) {
                // ignore if column already exists
            }
        }
        const indexStatements = [
            'CREATE INDEX IF NOT EXISTS idx_operations_reservation ON operations(reservation_id)',
            'CREATE INDEX IF NOT EXISTS idx_operations_bundle ON operations(bundle_id)',
            'CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)',
        ];
        for (const stmt of indexStatements) {
            try {
                this.db.prepare(stmt).run();
            }
            catch (error) {
                // ignore if index cannot be created
            }
        }
        this.backfillDefaultUser();
    }
    backfillDefaultUser() {
        try {
            const hasUsersTable = this.db
                .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
                .get() !== undefined;
            if (!hasUsersTable)
                return;
            let admin = this.db
                .prepare('SELECT * FROM users WHERE role = ? ORDER BY id LIMIT 1')
                .get('admin');
            if (!admin) {
                const passwordHash = bcrypt.hashSync('admin', 10);
                const now = new Date().toISOString();
                const result = this.db
                    .prepare(`INSERT INTO users (username, password_hash, role, created_at, updated_at)
             VALUES (@username, @password_hash, 'admin', @created_at, @updated_at)`)
                    .run({
                    username: 'admin',
                    password_hash: passwordHash,
                    created_at: now,
                    updated_at: now,
                });
                const adminId = Number(result.lastInsertRowid);
                admin = this.db.prepare('SELECT * FROM users WHERE id = ?').get(adminId);
            }
            const adminId = admin?.id ?? 1;
            const tablesToBackfill = ['products', 'bundles', 'reservations', 'operations', 'reminders'];
            for (const table of tablesToBackfill) {
                try {
                    this.db.prepare(`UPDATE ${table} SET user_id = ? WHERE user_id IS NULL`).run(adminId);
                    this.db.prepare(`UPDATE ${table} SET user_id = ? WHERE user_id = 0`).run(adminId);
                }
                catch (error) {
                    // ignore if table does not have user_id yet
                }
            }
        }
        catch (error) {
            console.error('Failed to backfill default user', error);
        }
    }
    resolveUserId(userId) {
        if (userId && userId > 0)
            return userId;
        const admin = this.db
            .prepare('SELECT id FROM users WHERE role = ? ORDER BY id LIMIT 1')
            .get('admin');
        if (admin?.id)
            return admin.id;
        this.backfillDefaultUser();
        const fallback = this.db
            .prepare('SELECT id FROM users ORDER BY id LIMIT 1')
            .get();
        return fallback?.id ?? 1;
    }
    listProducts(userId) {
        const ownerId = this.resolveUserId(userId);
        const products = this.db
            .prepare('SELECT * FROM products WHERE user_id = ? ORDER BY archived ASC, name COLLATE NOCASE ASC')
            .all(ownerId);
        const aliasesByProduct = this.loadAliases();
        const accessoriesByProduct = this.loadAccessories(products.map((p) => p.id));
        const stockByProduct = this.getStockByProduct(products.map((p) => p.id), ownerId);
        return products.map((product) => {
            const mapped = this.mapProduct(product);
            const stock = stockByProduct[mapped.id] ?? emptyStock;
            return {
                ...mapped,
                aliases: aliasesByProduct[mapped.id] ?? [],
                accessories: accessoriesByProduct[mapped.id] ?? [],
                stock,
            };
        });
    }
    createProduct(payload, userId) {
        const ownerId = this.resolveUserId(userId);
        const now = new Date().toISOString();
        const name = payload.name.trim();
        if (!name) {
            throw new Error('Название товара обязательно');
        }
        const insert = this.db.prepare(`
      INSERT INTO products (name, sku, model, min_stock, has_import_permit, notes, archived, created_at, updated_at, user_id)
      VALUES (@name, @sku, @model, @min_stock, @has_import_permit, @notes, 0, @created_at, @updated_at, @user_id)
    `);
        const result = insert.run({
            name,
            sku: payload.sku ?? null,
            model: payload.model?.trim() || null,
            min_stock: Math.max(0, payload.minStock ?? 0),
            has_import_permit: payload.hasImportPermit ? 1 : 0,
            notes: payload.notes ?? null,
            created_at: now,
            updated_at: now,
            user_id: ownerId,
        });
        const productId = Number(result.lastInsertRowid);
        if (payload.aliases?.length) {
            const insertAlias = this.db.prepare('INSERT INTO aliases (product_id, label) VALUES (@product_id, @label)');
            const insertMany = this.db.transaction((aliases) => {
                for (const label of aliases) {
                    if (label.trim()) {
                        insertAlias.run({ product_id: productId, label: label.trim() });
                    }
                }
            });
            insertMany(payload.aliases);
        }
        if (payload.accessoryIds?.length) {
            this.upsertAccessories(productId, payload.accessoryIds);
        }
        const created = this.db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
        return {
            ...this.mapProduct(created),
            aliases: this.loadAliases()[productId] ?? [],
            accessories: this.loadAccessories([productId])[productId] ?? [],
            stock: emptyStock,
        };
    }
    updateProduct(payload, userId) {
        const ownerId = this.resolveUserId(userId);
        const product = this.db.prepare('SELECT * FROM products WHERE id = ?').get(payload.id);
        if (!product) {
            throw new Error('Товар не найден');
        }
        if (product.user_id && product.user_id !== ownerId) {
            throw new Error('Нет доступа к товару');
        }
        const name = payload.name?.trim() ?? product.name;
        if (!name) {
            throw new Error('Название товара обязательно');
        }
        const updatedAt = new Date().toISOString();
        const nextSku = payload.sku !== undefined ? payload.sku : product.sku;
        const nextModel = payload.model !== undefined ? payload.model : product.model;
        const nextNotes = payload.notes !== undefined ? payload.notes : product.notes;
        const nextPermit = payload.hasImportPermit ?? Boolean(product.has_import_permit);
        const nextArchived = payload.archived ?? Boolean(product.archived);
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
    `);
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
        });
        if (payload.aliases) {
            const removeStmt = this.db.prepare('DELETE FROM aliases WHERE product_id = ?');
            const insertAlias = this.db.prepare('INSERT INTO aliases (product_id, label) VALUES (@product_id, @label)');
            const transaction = this.db.transaction((aliases) => {
                removeStmt.run(payload.id);
                for (const label of aliases) {
                    const trimmed = label.trim();
                    if (trimmed) {
                        insertAlias.run({ product_id: payload.id, label: trimmed });
                    }
                }
            });
            transaction(payload.aliases);
        }
        if (payload.accessoryIds) {
            this.upsertAccessories(payload.id, payload.accessoryIds);
        }
        const updated = this.db.prepare('SELECT * FROM products WHERE id = ?').get(payload.id);
        return {
            ...this.mapProduct(updated),
            aliases: this.loadAliases()[payload.id] ?? [],
            accessories: this.loadAccessories([payload.id])[payload.id] ?? [],
            stock: this.getStockByProduct([payload.id], ownerId)[payload.id] ?? emptyStock,
        };
    }
    listOperations(userId) {
        const ownerId = this.resolveUserId(userId);
        const rows = this.db
            .prepare(`
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
        WHERE o.user_id = @userId
        ORDER BY datetime(o.occurred_at) DESC, o.id DESC
      `)
            .all({ userId: ownerId });
        return rows.map((row) => this.mapOperation(row));
    }
    createOperation(payload, userId) {
        const ownerId = this.resolveUserId(userId);
        const product = this.db.prepare('SELECT * FROM products WHERE id = ?').get(payload.productId);
        if (!product) {
            throw new Error('Товар не найден');
        }
        if (!allowedOperationTypes.includes(payload.type)) {
            throw new Error('Неизвестный тип операции');
        }
        if (product.user_id && product.user_id !== ownerId) {
            throw new Error('Нет доступа к товару');
        }
        if (payload.quantity <= 0) {
            throw new Error('Количество должно быть больше 0');
        }
        const customer = payload.customer?.trim() ?? '';
        if (['ship_on_credit', 'close_debt'].includes(payload.type) && !customer) {
            throw new Error('Укажите клиента для операций с долгом');
        }
        if (payload.type === 'close_debt') {
            const currentDebt = this.getCustomerDebt(payload.productId, customer, ownerId);
            if (currentDebt <= 0) {
                throw new Error('Долг для этого клиента отсутствует');
            }
            if (payload.quantity > currentDebt) {
                throw new Error('Сумма погашения превышает остаток долга');
            }
        }
        const contact = payload.contact?.trim() ?? '';
        let reservationId = payload.reservationId ?? null;
        const bundleTitle = payload.bundleTitle?.trim() || null;
        let bundleId = payload.bundleId ?? null;
        const dueAt = payload.dueAt ?? null;
        const permitNumber = payload.permitNumber?.trim() || null;
        const paid = payload.paid ??
            (['sale', 'sale_from_reserve', 'close_debt'].includes(payload.type)
                ? true
                : payload.type === 'ship_on_credit'
                    ? false
                    : false);
        const occurred = payload.occurredAt ?? new Date().toISOString();
        const now = occurred;
        if (payload.type === 'reserve') {
            const linkCode = `BR-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
            const insertReserve = this.db.prepare(`
        INSERT INTO reservations (product_id, quantity, customer, contact, status, due_at, comment, link_code, created_at, updated_at, user_id)
        VALUES (@product_id, @quantity, @customer, @contact, 'active', @due_at, @comment, @link_code, @created_at, @updated_at, @user_id)
      `);
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
                user_id: ownerId,
            });
            reservationId = Number(resResult.lastInsertRowid);
        }
        if (['reserve_release', 'sale_from_reserve'].includes(payload.type)) {
            if (!reservationId) {
                throw new Error('Укажите бронь для изменения статуса');
            }
            const reservation = this.db
                .prepare('SELECT * FROM reservations WHERE id = ?')
                .get(reservationId);
            if (!reservation) {
                throw new Error('Бронь не найдена');
            }
            const nextStatus = payload.type === 'sale_from_reserve' ? 'sold' : 'released';
            this.db
                .prepare('UPDATE reservations SET status = ?, updated_at = ? WHERE id = ?')
                .run(nextStatus, now, reservationId);
        }
        if (!bundleId && bundleTitle) {
            const bundleInsert = this.db.prepare('INSERT INTO bundles (title, customer, note, created_at, user_id) VALUES (@title, @customer, @note, @created_at, @user_id)');
            const bundleResult = bundleInsert.run({
                title: bundleTitle,
                customer: customer || contact || null,
                note: payload.comment ?? null,
                created_at: now,
                user_id: ownerId,
            });
            bundleId = Number(bundleResult.lastInsertRowid);
        }
        const insert = this.db.prepare(`
      INSERT INTO operations (product_id, type, quantity, customer, contact, permit_number, paid, reservation_id, bundle_id, due_at, comment, occurred_at, user_id)
      VALUES (@product_id, @type, @quantity, @customer, @contact, @permit_number, @paid, @reservation_id, @bundle_id, @due_at, @comment, @occurred_at, @user_id)
    `);
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
            user_id: ownerId,
        });
        this.db.prepare('UPDATE products SET updated_at = ? WHERE id = ?').run(occurred, payload.productId);
        const created = this.db
            .prepare(`
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
        WHERE o.id = ? AND o.user_id = ?
      `)
            .get(result.lastInsertRowid, ownerId);
        const operationResult = this.mapOperation(created);
        // Автоматическое создание напоминаний
        // 1. Если создана бронь с датой окончания - напомнить за день до
        if (payload.type === 'reserve' && reservationId && dueAt) {
            const dueDate = new Date(dueAt);
            const reminderDate = new Date(dueDate);
            reminderDate.setDate(reminderDate.getDate() - 1); // За день до окончания
            // Создаем напоминание только если дата в будущем
            if (reminderDate > new Date()) {
                const reminderTitle = `Бронь истекает: ${product?.name ?? 'Товар'}`;
                const reminderMessage = `Бронь #${reservationId} (${customer || 'Клиент'}) истекает завтра. ${contact ? `Контакт: ${contact}` : ''}`;
                this.createReminder({
                    title: reminderTitle,
                    message: reminderMessage,
                    dueAt: reminderDate.toISOString(),
                    targetType: 'reservation',
                    targetId: reservationId,
                });
            }
        }
        // 2. Если отгрузка в долг - напомнить через 7 дней проверить оплату
        if (payload.type === 'ship_on_credit' && customer) {
            const reminderDate = new Date();
            reminderDate.setDate(reminderDate.getDate() + 7); // Через 7 дней
            const reminderTitle = `Проверить оплату долга: ${customer}`;
            const reminderMessage = `Отгружено в долг: ${product?.name ?? 'Товар'} (${payload.quantity} шт.). Клиент: ${customer}. ${contact ? `Контакт: ${contact}` : ''}`;
            this.createReminder({
                title: reminderTitle,
                message: reminderMessage,
                dueAt: reminderDate.toISOString(),
                targetType: 'operation',
                targetId: operationResult.id,
            }, ownerId);
        }
        return operationResult;
    }
    deleteOperation(id, userId) {
        const ownerId = this.resolveUserId(userId);
        const existing = this.db.prepare('SELECT * FROM operations WHERE id = ?').get(id);
        if (!existing)
            return;
        if (existing.user_id && existing.user_id !== ownerId) {
            throw new Error('Нет доступа к операции');
        }
        this.db.prepare('DELETE FROM operations WHERE id = ?').run(id);
        this.db
            .prepare('UPDATE products SET updated_at = ? WHERE id = ?')
            .run(new Date().toISOString(), existing.product_id);
    }
    deleteProduct(id, userId) {
        const ownerId = this.resolveUserId(userId);
        const product = this.db.prepare('SELECT * FROM products WHERE id = ?').get(id);
        if (!product)
            return;
        if (product.user_id && product.user_id !== ownerId) {
            throw new Error('Нет доступа к товару');
        }
        const { count } = this.db
            .prepare('SELECT COUNT(*) as count FROM operations WHERE product_id = ? AND user_id = ?')
            .get(id, ownerId);
        if (count > 0) {
            throw new Error('Товар используется в операциях и не может быть удален');
        }
        const remove = this.db.transaction((productId) => {
            this.db.prepare('DELETE FROM aliases WHERE product_id = ?').run(productId);
            this.db.prepare('DELETE FROM products WHERE id = ?').run(productId);
        });
        remove(id);
    }
    getDashboard(userId) {
        const ownerId = this.resolveUserId(userId);
        const products = this.listProducts(ownerId);
        const lowStock = products.filter((p) => !p.archived && p.minStock > 0 && p.stock.available < p.minStock);
        const totalReserved = products.reduce((sum, p) => sum + p.stock.reserved, 0);
        const debtRows = this.db
            .prepare(`
        SELECT product_id as productId, customer, SUM(
          CASE
            WHEN type = 'ship_on_credit' THEN quantity
            WHEN type = 'close_debt' THEN -quantity
            ELSE 0
          END
        ) as debt
        FROM operations
        WHERE customer IS NOT NULL AND user_id = @userId
        GROUP BY product_id, customer
        HAVING debt > 0
      `)
            .all({ userId: ownerId }) ?? [];
        const productMap = new Map(products.map((p) => [p.id, p]));
        return {
            lowStock,
            totalReserved,
            activeDebts: debtRows.map((row) => ({
                productId: row.productId,
                customer: row.customer,
                debt: row.debt,
                productName: productMap.get(row.productId)?.name ?? 'Неизвестно',
            })),
        };
    }
    listReservations(userId) {
        const ownerId = this.resolveUserId(userId);
        const rows = this.db
            .prepare(`
        SELECT r.*, p.name as product_name, p.sku as product_sku
        FROM reservations r
        LEFT JOIN products p ON p.id = r.product_id
        WHERE r.user_id = @userId
        ORDER BY datetime(r.due_at) ASC, r.id DESC
      `)
            .all({ userId: ownerId }) ?? [];
        return rows.map((row) => {
            const status = row.status === 'active' && row.due_at && new Date(row.due_at) < new Date()
                ? 'expired'
                : row.status;
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
            };
        });
    }
    updateReservation(payload, userId) {
        const ownerId = this.resolveUserId(userId);
        const existing = this.db
            .prepare('SELECT * FROM reservations WHERE id = ?')
            .get(payload.id);
        if (!existing) {
            throw new Error('Бронь не найдена');
        }
        if (existing.user_id && existing.user_id !== ownerId) {
            throw new Error('Нет доступа к брони');
        }
        const nextStatus = payload.status ?? existing.status;
        const updateStmt = this.db.prepare(`
      UPDATE reservations
      SET customer = @customer,
          contact = @contact,
          status = @status,
          due_at = @due_at,
          comment = @comment,
          updated_at = @updated_at
      WHERE id = @id
    `);
        const updatedAt = new Date().toISOString();
        updateStmt.run({
            id: payload.id,
            customer: payload.customer ?? existing.customer,
            contact: payload.contact ?? existing.contact,
            status: nextStatus,
            due_at: payload.dueAt ?? existing.due_at,
            comment: payload.comment ?? existing.comment,
            updated_at: updatedAt,
        });
        const row = this.db
            .prepare(`
        SELECT r.*, p.name as product_name, p.sku as product_sku
        FROM reservations r
        LEFT JOIN products p ON p.id = r.product_id
        WHERE r.id = ?
      `)
            .get(payload.id);
        if (!row) {
            throw new Error('Не удалось обновить бронь');
        }
        const status = row.status === 'active' && row.due_at && new Date(row.due_at) < new Date()
            ? 'expired'
            : row.status;
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
        };
    }
    listReminders(userId) {
        const ownerId = this.resolveUserId(userId);
        const rows = this.db
            .prepare('SELECT * FROM reminders WHERE user_id = @userId ORDER BY done ASC, datetime(due_at) ASC')
            .all({ userId: ownerId }) ?? [];
        return rows.map((row) => ({
            id: row.id,
            title: row.title,
            message: row.message ?? undefined,
            dueAt: row.due_at,
            done: Boolean(row.done),
            targetType: row.target_type ?? null,
            targetId: row.target_id ?? null,
            createdAt: row.created_at,
        }));
    }
    createReminder(payload, userId) {
        const ownerId = this.resolveUserId(userId);
        const insert = this.db.prepare(`
      INSERT INTO reminders (title, message, due_at, done, target_type, target_id, created_at, user_id)
      VALUES (@title, @message, @due_at, 0, @target_type, @target_id, @created_at, @user_id)
    `);
        const now = new Date().toISOString();
        const result = insert.run({
            title: payload.title,
            message: payload.message ?? null,
            due_at: payload.dueAt,
            target_type: payload.targetType ?? null,
            target_id: payload.targetId ?? null,
            created_at: now,
            user_id: ownerId,
        });
        return {
            id: Number(result.lastInsertRowid),
            title: payload.title,
            message: payload.message ?? undefined,
            dueAt: payload.dueAt,
            done: false,
            targetType: payload.targetType ?? null,
            targetId: payload.targetId ?? null,
            createdAt: now,
        };
    }
    updateReminder(payload, userId) {
        const ownerId = this.resolveUserId(userId);
        const existing = this.db
            .prepare('SELECT * FROM reminders WHERE id = ?')
            .get(payload.id);
        if (!existing) {
            throw new Error('Напоминание не найдено');
        }
        if (existing.user_id && existing.user_id !== ownerId) {
            throw new Error('Нет доступа к напоминанию');
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
    `);
        update.run({
            id: payload.id,
            title: payload.title ?? existing.title,
            message: payload.message ?? existing.message,
            due_at: payload.dueAt ?? existing.due_at,
            done: (payload.done ?? Boolean(existing.done)) ? 1 : 0,
            target_type: payload.targetType ?? existing.target_type,
            target_id: payload.targetId ?? existing.target_id,
        });
        const updated = this.db
            .prepare('SELECT * FROM reminders WHERE id = ?')
            .get(payload.id);
        return {
            id: updated.id,
            title: updated.title,
            message: updated.message ?? undefined,
            dueAt: updated.due_at,
            done: Boolean(updated.done),
            targetType: updated.target_type ?? null,
            targetId: updated.target_id ?? null,
            createdAt: updated.created_at,
        };
    }
    loadAliases() {
        const rows = this.db.prepare('SELECT * FROM aliases').all();
        return rows.reduce((acc, row) => {
            acc[row.product_id] = acc[row.product_id] ?? [];
            acc[row.product_id].push({
                id: row.id,
                productId: row.product_id,
                label: row.label,
            });
            return acc;
        }, {});
    }
    loadAccessories(productIds) {
        const filter = productIds?.length ? `WHERE pa.product_id IN (${productIds.map(() => '?').join(',')})` : '';
        const params = productIds?.length ? productIds : [];
        const rows = this.db
            .prepare(`
        SELECT pa.id, pa.product_id, pa.accessory_id, p.name as accessory_name, p.sku as accessory_sku
        FROM product_accessories pa
        LEFT JOIN products p ON p.id = pa.accessory_id
        ${filter}
      `)
            .all(...params) ?? [];
        return rows.reduce((acc, row) => {
            acc[row.product_id] = acc[row.product_id] ?? [];
            acc[row.product_id].push({
                id: row.id,
                productId: row.product_id,
                accessoryId: row.accessory_id,
                accessoryName: row.accessory_name ?? 'Аксессуар',
                accessorySku: row.accessory_sku,
            });
            return acc;
        }, {});
    }
    upsertAccessories(productId, accessoryIds) {
        const uniqueIds = Array.from(new Set(accessoryIds.filter((id) => id !== productId)));
        const removeStmt = this.db.prepare('DELETE FROM product_accessories WHERE product_id = ?');
        const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO product_accessories (product_id, accessory_id) VALUES (@product_id, @accessory_id)
    `);
        const tx = this.db.transaction(() => {
            removeStmt.run(productId);
            for (const accessoryId of uniqueIds) {
                insertStmt.run({ product_id: productId, accessory_id: accessoryId });
            }
        });
        tx();
    }
    mapProduct(row) {
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
        };
    }
    mapOperation(row) {
        const reservationStatus = row.reservation_status === 'active' && row.reservation_due_at
            ? new Date(row.reservation_due_at) < new Date()
                ? 'expired'
                : row.reservation_status
            : row.reservation_status;
        return {
            id: row.id,
            productId: row.product_id,
            type: row.type,
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
                    status: (reservationStatus ?? 'active'),
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
        };
    }
    getCustomerDebt(productId, customer, userId) {
        const ownerId = this.resolveUserId(userId);
        if (!customer)
            return 0;
        const row = this.db
            .prepare(`
      SELECT SUM(
        CASE
          WHEN type = 'ship_on_credit' THEN quantity
          WHEN type = 'close_debt' THEN -quantity
          ELSE 0
        END
      ) as debt
      FROM operations
      WHERE product_id = ? AND lower(trim(customer)) = lower(trim(?)) AND user_id = ?
    `)
            .get(productId, customer, ownerId);
        return row?.debt ?? 0;
    }
    getStockByProduct(productIds, userId) {
        const ownerId = this.resolveUserId(userId);
        const filter = productIds?.length ? `WHERE product_id IN (${productIds.map(() => '?').join(',')})` : '';
        const params = productIds?.length ? [...productIds, ownerId] : [ownerId];
        const rows = (this.db
            .prepare(`
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
        ${filter ? `${filter} AND user_id = ?` : 'WHERE user_id = ?'}
        GROUP BY product_id
      `)
            .all(...params)) ?? [];
        const stockByProduct = {};
        for (const row of rows) {
            const onHand = row.onHand ?? 0;
            const reserved = row.reserved ?? 0;
            const debt = row.debt ?? 0;
            stockByProduct[row.productId] = {
                onHand,
                reserved,
                debt,
                balance: onHand,
                available: onHand - reserved,
            };
        }
        if (productIds?.length) {
            for (const id of productIds) {
                stockByProduct[id] = stockByProduct[id] ?? { ...emptyStock };
            }
        }
        return stockByProduct;
    }
    // ----- Users & Auth -----
    login(payload) {
        const userRow = this.db
            .prepare('SELECT * FROM users WHERE lower(username) = lower(?)')
            .get(payload.username);
        if (!userRow) {
            throw new Error('Неверный логин или пароль');
        }
        const valid = bcrypt.compareSync(payload.password, userRow.password_hash);
        if (!valid) {
            throw new Error('Неверный логин или пароль');
        }
        const session = this.createSession(userRow.id, 30);
        return { user: this.mapUser(userRow), session };
    }
    createSession(userId, days = 30) {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
        const now = new Date().toISOString();
        const result = this.db
            .prepare('INSERT INTO sessions (user_id, token, expires_at, created_at) VALUES (@user_id, @token, @expires_at, @created_at)')
            .run({
            user_id: userId,
            token,
            expires_at: expiresAt,
            created_at: now,
        });
        return {
            id: Number(result.lastInsertRowid),
            userId,
            token,
            expiresAt,
            createdAt: now,
        };
    }
    getSessionByToken(token) {
        if (!token)
            return null;
        const row = this.db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
        if (!row)
            return null;
        return {
            id: row.id,
            userId: row.user_id,
            token: row.token,
            expiresAt: row.expires_at,
            createdAt: row.created_at,
        };
    }
    deleteSession(token) {
        if (!token)
            return;
        this.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    }
    getUserById(id) {
        const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        return row ? this.mapUser(row) : null;
    }
    listUsers() {
        const rows = this.db.prepare('SELECT * FROM users ORDER BY id ASC').all();
        return rows.map((row) => this.mapUser(row));
    }
    createUser(payload) {
        const username = payload.username.trim();
        if (!username) {
            throw new Error('Имя пользователя обязательно');
        }
        if (!payload.password) {
            throw new Error('Пароль обязателен');
        }
        const existing = this.db
            .prepare('SELECT id FROM users WHERE lower(username) = lower(?)')
            .get(username);
        if (existing) {
            throw new Error('Пользователь с таким именем уже существует');
        }
        const now = new Date().toISOString();
        const passwordHash = bcrypt.hashSync(payload.password, 10);
        const role = payload.role ?? 'user';
        const result = this.db
            .prepare(`INSERT INTO users (username, password_hash, role, email, created_at, updated_at)
         VALUES (@username, @password_hash, @role, @email, @created_at, @updated_at)`)
            .run({
            username,
            password_hash: passwordHash,
            role,
            email: payload.email ?? null,
            created_at: now,
            updated_at: now,
        });
        return this.mapUser(this.db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid));
    }
    updateUser(payload) {
        const existing = this.db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
        if (!existing) {
            throw new Error('Пользователь не найден');
        }
        const nextUsername = payload.username?.trim() || existing.username;
        const nextPasswordHash = payload.password ? bcrypt.hashSync(payload.password, 10) : existing.password_hash;
        const nextRole = payload.role ?? existing.role;
        const nextEmail = payload.email ?? existing.email;
        const updatedAt = new Date().toISOString();
        this.db
            .prepare(`UPDATE users
         SET username = @username,
             password_hash = @password_hash,
             role = @role,
             email = @email,
             google_drive_folder_id = @google_drive_folder_id,
             google_drive_client_id = @google_drive_client_id,
             google_drive_client_secret = @google_drive_client_secret,
             updated_at = @updated_at
         WHERE id = @id`)
            .run({
            id: payload.id,
            username: nextUsername,
            password_hash: nextPasswordHash,
            role: nextRole,
            email: nextEmail ?? null,
            google_drive_folder_id: payload.googleDriveFolderId ?? existing.google_drive_folder_id,
            google_drive_client_id: payload.googleDriveClientId ?? existing.google_drive_client_id,
            google_drive_client_secret: payload.googleDriveClientSecret ?? existing.google_drive_client_secret,
            updated_at: updatedAt,
        });
        const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
        return this.mapUser(row);
    }
    deleteUser(id) {
        const existing = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        if (!existing)
            return;
        if (existing.role === 'admin') {
            const { admins } = this.db
                .prepare("SELECT COUNT(*) as admins FROM users WHERE role = 'admin'")
                .get();
            if (admins <= 1) {
                throw new Error('Нельзя удалить последнего администратора');
            }
        }
        this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
        this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    }
    getUserGoogleDriveConfig(userId) {
        const user = this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!user)
            return null;
        return {
            clientId: user.google_drive_client_id,
            clientSecret: user.google_drive_client_secret,
            folderId: user.google_drive_folder_id,
            accessToken: null,
            refreshToken: null,
        };
    }
    updateUserGoogleDriveConfig(userId, clientId, clientSecret, folderId) {
        const existing = this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!existing) {
            throw new Error('Пользователь не найден');
        }
        this.db
            .prepare(`UPDATE users
         SET google_drive_client_id = @clientId,
             google_drive_client_secret = @clientSecret,
             google_drive_folder_id = @folderId,
             updated_at = @updated_at
         WHERE id = @id`)
            .run({
            id: userId,
            clientId,
            clientSecret,
            folderId: folderId ?? existing.google_drive_folder_id,
            updated_at: new Date().toISOString(),
        });
    }
    exportSnapshot(includeUsers = false, userId) {
        const ownerId = this.resolveUserId(userId);
        const snapshot = {
            products: this.listProducts(ownerId),
            operations: this.listOperations(ownerId),
            reservations: this.listReservations(ownerId),
            reminders: this.listReminders(ownerId),
            bundles: this.listBundles(ownerId),
        };
        if (includeUsers) {
            const user = this.getUserById(ownerId);
            snapshot.users = user ? [user] : [];
        }
        return snapshot;
    }
    importSnapshot(snapshot, userId) {
        const ownerId = this.resolveUserId(userId);
        const tx = this.db.transaction(() => {
            // Clean previous data for this user
            this.db.prepare('DELETE FROM operations WHERE user_id = ?').run(ownerId);
            this.db.prepare('DELETE FROM reservations WHERE user_id = ?').run(ownerId);
            this.db.prepare('DELETE FROM reminders WHERE user_id = ?').run(ownerId);
            this.db.prepare('DELETE FROM product_accessories WHERE product_id IN (SELECT id FROM products WHERE user_id = ?)').run(ownerId);
            this.db.prepare('DELETE FROM aliases WHERE product_id IN (SELECT id FROM products WHERE user_id = ?)').run(ownerId);
            this.db.prepare('DELETE FROM bundles WHERE user_id = ?').run(ownerId);
            this.db.prepare('DELETE FROM products WHERE user_id = ?').run(ownerId);
            // Bundles
            if (snapshot.bundles?.length) {
                const insertBundle = this.db.prepare(`INSERT OR REPLACE INTO bundles (id, user_id, title, customer, note, created_at)
           VALUES (@id, @user_id, @title, @customer, @note, @created_at)`);
                for (const bundle of snapshot.bundles) {
                    insertBundle.run({
                        id: bundle.id,
                        user_id: ownerId,
                        title: bundle.title ?? null,
                        customer: bundle.customer ?? null,
                        note: bundle.note ?? null,
                        created_at: bundle.createdAt ?? new Date().toISOString(),
                    });
                }
            }
            // Products
            const insertProduct = this.db.prepare(`INSERT OR REPLACE INTO products (id, user_id, name, sku, model, min_stock, has_import_permit, notes, archived, created_at, updated_at)
         VALUES (@id, @user_id, @name, @sku, @model, @min_stock, @has_import_permit, @notes, @archived, @created_at, @updated_at)`);
            const insertAlias = this.db.prepare('INSERT INTO aliases (id, product_id, label) VALUES (@id, @product_id, @label)');
            const insertAccessory = this.db.prepare('INSERT OR IGNORE INTO product_accessories (product_id, accessory_id) VALUES (@product_id, @accessory_id)');
            for (const product of snapshot.products ?? []) {
                insertProduct.run({
                    id: product.id,
                    user_id: ownerId,
                    name: product.name,
                    sku: product.sku ?? null,
                    model: product.model ?? null,
                    min_stock: product.minStock ?? 0,
                    has_import_permit: product.hasImportPermit ? 1 : 0,
                    notes: product.notes ?? null,
                    archived: product.archived ? 1 : 0,
                    created_at: product.createdAt ?? new Date().toISOString(),
                    updated_at: product.updatedAt ?? new Date().toISOString(),
                });
                if (product.aliases?.length) {
                    for (const alias of product.aliases) {
                        insertAlias.run({
                            id: alias.id,
                            product_id: product.id,
                            label: alias.label,
                        });
                    }
                }
                if (product.accessories?.length) {
                    for (const accessory of product.accessories) {
                        insertAccessory.run({
                            product_id: product.id,
                            accessory_id: accessory.accessoryId,
                        });
                    }
                }
            }
            // Reservations
            if (snapshot.reservations?.length) {
                const insertReservation = this.db.prepare(`INSERT OR REPLACE INTO reservations (id, user_id, product_id, quantity, customer, contact, status, due_at, comment, link_code, created_at, updated_at)
           VALUES (@id, @user_id, @product_id, @quantity, @customer, @contact, @status, @due_at, @comment, @link_code, @created_at, @updated_at)`);
                for (const res of snapshot.reservations) {
                    insertReservation.run({
                        id: res.id,
                        user_id: ownerId,
                        product_id: res.productId,
                        quantity: res.quantity,
                        customer: res.customer ?? null,
                        contact: res.contact ?? null,
                        status: res.status,
                        due_at: res.dueAt ?? null,
                        comment: res.comment ?? null,
                        link_code: res.linkCode,
                        created_at: res.createdAt ?? new Date().toISOString(),
                        updated_at: res.updatedAt ?? new Date().toISOString(),
                    });
                }
            }
            // Operations
            if (snapshot.operations?.length) {
                const insertOperation = this.db.prepare(`INSERT OR REPLACE INTO operations
          (id, user_id, product_id, type, quantity, customer, contact, permit_number, paid, reservation_id, bundle_id, due_at, comment, occurred_at, created_at)
          VALUES
          (@id, @user_id, @product_id, @type, @quantity, @customer, @contact, @permit_number, @paid, @reservation_id, @bundle_id, @due_at, @comment, @occurred_at, @created_at)`);
                for (const op of snapshot.operations) {
                    insertOperation.run({
                        id: op.id,
                        user_id: ownerId,
                        product_id: op.productId,
                        type: op.type,
                        quantity: op.quantity,
                        customer: op.customer ?? null,
                        contact: op.contact ?? null,
                        permit_number: op.permitNumber ?? null,
                        paid: op.paid ? 1 : 0,
                        reservation_id: op.reservationId ?? null,
                        bundle_id: op.bundleId ?? null,
                        due_at: op.dueAt ?? null,
                        comment: op.comment ?? null,
                        occurred_at: op.occurredAt,
                        created_at: op.createdAt ?? op.occurredAt ?? new Date().toISOString(),
                    });
                }
            }
            // Reminders
            if (snapshot.reminders?.length) {
                const insertReminder = this.db.prepare(`INSERT OR REPLACE INTO reminders (id, user_id, title, message, due_at, done, target_type, target_id, created_at)
           VALUES (@id, @user_id, @title, @message, @due_at, @done, @target_type, @target_id, @created_at)`);
                for (const reminder of snapshot.reminders) {
                    insertReminder.run({
                        id: reminder.id,
                        user_id: ownerId,
                        title: reminder.title,
                        message: reminder.message ?? null,
                        due_at: reminder.dueAt,
                        done: reminder.done ? 1 : 0,
                        target_type: reminder.targetType ?? null,
                        target_id: reminder.targetId ?? null,
                        created_at: reminder.createdAt ?? new Date().toISOString(),
                    });
                }
            }
        });
        tx();
    }
    mapUser(row) {
        return {
            id: row.id,
            username: row.username,
            role: row.role ?? 'user',
            email: row.email ?? null,
            googleDriveFolderId: row.google_drive_folder_id,
            googleDriveClientId: row.google_drive_client_id,
            googleDriveClientSecret: row.google_drive_client_secret,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    listBundles(userId) {
        const ownerId = this.resolveUserId(userId);
        const rows = this.db
            .prepare('SELECT * FROM bundles WHERE user_id = ? ORDER BY id DESC')
            .all(ownerId) ?? [];
        return rows.map((row) => ({
            id: row.id,
            title: row.title,
            customer: row.customer,
            note: row.note,
            createdAt: row.created_at,
        }));
    }
}
