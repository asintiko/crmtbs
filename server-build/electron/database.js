var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
var emptyStock = {
    onHand: 0,
    reserved: 0,
    debt: 0,
    balance: 0,
    available: 0,
};
var allowedOperationTypes = [
    'purchase',
    'sale',
    'reserve',
    'reserve_release',
    'sale_from_reserve',
    'ship_on_credit',
    'close_debt',
    'return',
];
var InventoryDatabase = /** @class */ (function () {
    function InventoryDatabase(filePath) {
        this.filePath = filePath;
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        this.db = new Database(filePath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
        this.migrate();
    }
    InventoryDatabase.prototype.getPath = function () {
        return this.filePath;
    };
    InventoryDatabase.prototype.migrate = function () {
        this.db.exec("\n      CREATE TABLE IF NOT EXISTS users (\n        id INTEGER PRIMARY KEY AUTOINCREMENT,\n        username TEXT UNIQUE NOT NULL,\n        password_hash TEXT NOT NULL,\n        role TEXT NOT NULL DEFAULT 'user',\n        email TEXT,\n        google_drive_folder_id TEXT,\n        google_drive_client_id TEXT,\n        google_drive_client_secret TEXT,\n        created_at TEXT DEFAULT CURRENT_TIMESTAMP,\n        updated_at TEXT DEFAULT CURRENT_TIMESTAMP\n      );\n\n      CREATE TABLE IF NOT EXISTS sessions (\n        id INTEGER PRIMARY KEY AUTOINCREMENT,\n        user_id INTEGER NOT NULL,\n        token TEXT NOT NULL UNIQUE,\n        expires_at TEXT NOT NULL,\n        created_at TEXT DEFAULT CURRENT_TIMESTAMP,\n        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE\n      );\n\n      CREATE TABLE IF NOT EXISTS products (\n        id INTEGER PRIMARY KEY AUTOINCREMENT,\n        user_id INTEGER NOT NULL DEFAULT 1,\n        name TEXT NOT NULL,\n        sku TEXT,\n        model TEXT,\n        min_stock INTEGER DEFAULT 0,\n        has_import_permit INTEGER DEFAULT 0,\n        notes TEXT,\n        archived INTEGER DEFAULT 0,\n        created_at TEXT DEFAULT CURRENT_TIMESTAMP,\n        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,\n        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE\n      );\n\n      CREATE TABLE IF NOT EXISTS aliases (\n        id INTEGER PRIMARY KEY AUTOINCREMENT,\n        product_id INTEGER NOT NULL,\n        label TEXT NOT NULL,\n        FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE\n      );\n\n      CREATE TABLE IF NOT EXISTS product_accessories (\n        id INTEGER PRIMARY KEY AUTOINCREMENT,\n        product_id INTEGER NOT NULL,\n        accessory_id INTEGER NOT NULL,\n        UNIQUE(product_id, accessory_id),\n        FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,\n        FOREIGN KEY(accessory_id) REFERENCES products(id) ON DELETE CASCADE\n      );\n\n      CREATE TABLE IF NOT EXISTS bundles (\n        id INTEGER PRIMARY KEY AUTOINCREMENT,\n        user_id INTEGER NOT NULL DEFAULT 1,\n        title TEXT,\n        customer TEXT,\n        note TEXT,\n        created_at TEXT DEFAULT CURRENT_TIMESTAMP,\n        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE\n      );\n\n      CREATE TABLE IF NOT EXISTS reservations (\n        id INTEGER PRIMARY KEY AUTOINCREMENT,\n        user_id INTEGER NOT NULL DEFAULT 1,\n        product_id INTEGER NOT NULL,\n        quantity REAL NOT NULL,\n        customer TEXT,\n        contact TEXT,\n        status TEXT NOT NULL DEFAULT 'active',\n        due_at TEXT,\n        comment TEXT,\n        link_code TEXT NOT NULL,\n        created_at TEXT DEFAULT CURRENT_TIMESTAMP,\n        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,\n        FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,\n        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE\n      );\n\n      CREATE TABLE IF NOT EXISTS operations (\n        id INTEGER PRIMARY KEY AUTOINCREMENT,\n        user_id INTEGER NOT NULL DEFAULT 1,\n        product_id INTEGER NOT NULL,\n        type TEXT NOT NULL,\n        quantity REAL NOT NULL,\n        customer TEXT,\n        contact TEXT,\n        permit_number TEXT,\n        paid INTEGER DEFAULT 0,\n        reservation_id INTEGER,\n        bundle_id INTEGER,\n        due_at TEXT,\n        comment TEXT,\n        occurred_at TEXT NOT NULL,\n        created_at TEXT DEFAULT CURRENT_TIMESTAMP,\n        FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,\n        FOREIGN KEY(reservation_id) REFERENCES reservations(id) ON DELETE SET NULL,\n        FOREIGN KEY(bundle_id) REFERENCES bundles(id) ON DELETE SET NULL,\n        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE\n      );\n\n      CREATE TABLE IF NOT EXISTS reminders (\n        id INTEGER PRIMARY KEY AUTOINCREMENT,\n        user_id INTEGER NOT NULL DEFAULT 1,\n        title TEXT NOT NULL,\n        message TEXT,\n        due_at TEXT NOT NULL,\n        done INTEGER DEFAULT 0,\n        target_type TEXT,\n        target_id INTEGER,\n        created_at TEXT DEFAULT CURRENT_TIMESTAMP,\n        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE\n      );\n\n      CREATE TABLE IF NOT EXISTS audit_log (\n        id INTEGER PRIMARY KEY AUTOINCREMENT,\n        user_id INTEGER NOT NULL,\n        action_type TEXT NOT NULL,\n        entity_type TEXT NOT NULL,\n        entity_id INTEGER,\n        details TEXT,\n        ip_address TEXT,\n        user_agent TEXT,\n        created_at TEXT DEFAULT CURRENT_TIMESTAMP,\n        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE\n      );\n\n      CREATE INDEX IF NOT EXISTS idx_operations_product_id ON operations(product_id);\n      CREATE INDEX IF NOT EXISTS idx_aliases_product_id ON aliases(product_id);\n      CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_at);\n      CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id);\n      CREATE INDEX IF NOT EXISTS idx_operations_user ON operations(user_id);\n      CREATE INDEX IF NOT EXISTS idx_reservations_user ON reservations(user_id);\n      CREATE INDEX IF NOT EXISTS idx_bundles_user ON bundles(user_id);\n      CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id);\n      CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);\n      CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);\n      CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);\n    ");
        var alterStatements = [
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
            "ALTER TABLE sessions ADD COLUMN max_sessions INTEGER DEFAULT 5",
        ];
        for (var _i = 0, alterStatements_1 = alterStatements; _i < alterStatements_1.length; _i++) {
            var stmt = alterStatements_1[_i];
            try {
                this.db.prepare(stmt).run();
            }
            catch (error) {
                // ignore if column already exists
            }
        }
        var indexStatements = [
            'CREATE INDEX IF NOT EXISTS idx_operations_reservation ON operations(reservation_id)',
            'CREATE INDEX IF NOT EXISTS idx_operations_bundle ON operations(bundle_id)',
            'CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)',
        ];
        for (var _a = 0, indexStatements_1 = indexStatements; _a < indexStatements_1.length; _a++) {
            var stmt = indexStatements_1[_a];
            try {
                this.db.prepare(stmt).run();
            }
            catch (error) {
                // ignore if index cannot be created
            }
        }
        this.backfillDefaultUser();
    };
    InventoryDatabase.prototype.backfillDefaultUser = function () {
        var _a;
        try {
            var hasUsersTable = this.db
                .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
                .get() !== undefined;
            if (!hasUsersTable)
                return;
            var admin = this.db
                .prepare('SELECT * FROM users WHERE role = ? ORDER BY id LIMIT 1')
                .get('admin');
            if (!admin) {
                var passwordHash = bcrypt.hashSync('admin', 10);
                var now = new Date().toISOString();
                var result = this.db
                    .prepare("INSERT INTO users (username, password_hash, role, created_at, updated_at)\n             VALUES (@username, @password_hash, 'admin', @created_at, @updated_at)")
                    .run({
                    username: 'admin',
                    password_hash: passwordHash,
                    created_at: now,
                    updated_at: now,
                });
                var adminId_1 = Number(result.lastInsertRowid);
                admin = this.db.prepare('SELECT * FROM users WHERE id = ?').get(adminId_1);
            }
            var adminId = (_a = admin === null || admin === void 0 ? void 0 : admin.id) !== null && _a !== void 0 ? _a : 1;
            var tablesToBackfill = ['products', 'bundles', 'reservations', 'operations', 'reminders'];
            for (var _i = 0, tablesToBackfill_1 = tablesToBackfill; _i < tablesToBackfill_1.length; _i++) {
                var table = tablesToBackfill_1[_i];
                try {
                    this.db.prepare("UPDATE ".concat(table, " SET user_id = ? WHERE user_id IS NULL")).run(adminId);
                    this.db.prepare("UPDATE ".concat(table, " SET user_id = ? WHERE user_id = 0")).run(adminId);
                }
                catch (error) {
                    // ignore if table does not have user_id yet
                }
            }
        }
        catch (error) {
            console.error('Failed to backfill default user', error);
        }
    };
    InventoryDatabase.prototype.resolveUserId = function (userId) {
        var _a;
        if (userId && userId > 0)
            return userId;
        var admin = this.db
            .prepare('SELECT id FROM users WHERE role = ? ORDER BY id LIMIT 1')
            .get('admin');
        if (admin === null || admin === void 0 ? void 0 : admin.id)
            return admin.id;
        this.backfillDefaultUser();
        var fallback = this.db
            .prepare('SELECT id FROM users ORDER BY id LIMIT 1')
            .get();
        return (_a = fallback === null || fallback === void 0 ? void 0 : fallback.id) !== null && _a !== void 0 ? _a : 1;
    };
    InventoryDatabase.prototype.listProducts = function (userId) {
        var _this = this;
        var ownerId = this.resolveUserId(userId);
        var products = this.db
            .prepare('SELECT * FROM products WHERE user_id = ? ORDER BY archived ASC, name COLLATE NOCASE ASC')
            .all(ownerId);
        var productIds = products.map(function (p) { return p.id; });
        var aliasesByProduct = this.loadAliases(ownerId, productIds);
        var accessoriesByProduct = this.loadAccessories(productIds, ownerId);
        var stockByProduct = this.getStockByProduct(productIds, ownerId);
        return products.map(function (product) {
            var _a, _b, _c;
            var mapped = _this.mapProduct(product);
            var stock = (_a = stockByProduct[mapped.id]) !== null && _a !== void 0 ? _a : emptyStock;
            return __assign(__assign({}, mapped), { aliases: (_b = aliasesByProduct[mapped.id]) !== null && _b !== void 0 ? _b : [], accessories: (_c = accessoriesByProduct[mapped.id]) !== null && _c !== void 0 ? _c : [], stock: stock });
        });
    };
    InventoryDatabase.prototype.createProduct = function (payload, userId) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        var ownerId = this.resolveUserId(userId);
        var now = new Date().toISOString();
        var name = payload.name.trim();
        if (!name) {
            throw new Error('Название товара обязательно');
        }
        var insert = this.db.prepare("\n      INSERT INTO products (name, sku, model, min_stock, has_import_permit, notes, archived, created_at, updated_at, user_id)\n      VALUES (@name, @sku, @model, @min_stock, @has_import_permit, @notes, 0, @created_at, @updated_at, @user_id)\n    ");
        var result = insert.run({
            name: name,
            sku: (_a = payload.sku) !== null && _a !== void 0 ? _a : null,
            model: ((_b = payload.model) === null || _b === void 0 ? void 0 : _b.trim()) || null,
            min_stock: Math.max(0, (_c = payload.minStock) !== null && _c !== void 0 ? _c : 0),
            has_import_permit: payload.hasImportPermit ? 1 : 0,
            notes: (_d = payload.notes) !== null && _d !== void 0 ? _d : null,
            created_at: now,
            updated_at: now,
            user_id: ownerId,
        });
        var productId = Number(result.lastInsertRowid);
        // Логируем операцию
        this.logAuditEvent(ownerId, 'create', 'product', productId, JSON.stringify({ name: name, sku: payload.sku }));
        if ((_e = payload.aliases) === null || _e === void 0 ? void 0 : _e.length) {
            var insertAlias_1 = this.db.prepare('INSERT INTO aliases (product_id, label) VALUES (@product_id, @label)');
            var insertMany = this.db.transaction(function (aliases) {
                for (var _i = 0, aliases_1 = aliases; _i < aliases_1.length; _i++) {
                    var label = aliases_1[_i];
                    if (label.trim()) {
                        insertAlias_1.run({ product_id: productId, label: label.trim() });
                    }
                }
            });
            insertMany(payload.aliases);
        }
        if ((_f = payload.accessoryIds) === null || _f === void 0 ? void 0 : _f.length) {
            this.upsertAccessories(productId, payload.accessoryIds, ownerId);
        }
        var created = this.db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
        return __assign(__assign({}, this.mapProduct(created)), { aliases: (_g = this.loadAliases(ownerId, [productId])[productId]) !== null && _g !== void 0 ? _g : [], accessories: (_h = this.loadAccessories([productId], ownerId)[productId]) !== null && _h !== void 0 ? _h : [], stock: emptyStock });
    };
    InventoryDatabase.prototype.updateProduct = function (payload, userId) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        var ownerId = this.resolveUserId(userId);
        var product = this.db.prepare('SELECT * FROM products WHERE id = ?').get(payload.id);
        if (!product) {
            throw new Error('Товар не найден');
        }
        if (product.user_id && product.user_id !== ownerId) {
            console.warn("\u26A0\uFE0F \u041F\u043E\u043F\u044B\u0442\u043A\u0430 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u0442\u043E\u0432\u0430\u0440\u0430 ".concat(payload.id, " \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F ").concat(product.user_id, " \u043E\u0442 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F ").concat(ownerId));
            throw new Error('Нет доступа к товару');
        }
        var name = (_b = (_a = payload.name) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : product.name;
        if (!name) {
            throw new Error('Название товара обязательно');
        }
        var updatedAt = new Date().toISOString();
        var nextSku = payload.sku !== undefined ? payload.sku : product.sku;
        var nextModel = payload.model !== undefined ? payload.model : product.model;
        var nextNotes = payload.notes !== undefined ? payload.notes : product.notes;
        var nextPermit = (_c = payload.hasImportPermit) !== null && _c !== void 0 ? _c : Boolean(product.has_import_permit);
        var nextArchived = (_d = payload.archived) !== null && _d !== void 0 ? _d : Boolean(product.archived);
        var updateStmt = this.db.prepare("\n      UPDATE products\n      SET name = @name,\n          sku = @sku,\n          model = @model,\n          min_stock = @min_stock,\n          has_import_permit = @has_import_permit,\n          notes = @notes,\n          archived = @archived,\n          updated_at = @updated_at\n      WHERE id = @id\n    ");
        updateStmt.run({
            id: payload.id,
            name: name,
            sku: nextSku,
            model: nextModel,
            min_stock: Math.max(0, (_f = (_e = payload.minStock) !== null && _e !== void 0 ? _e : product.min_stock) !== null && _f !== void 0 ? _f : 0),
            has_import_permit: nextPermit ? 1 : 0,
            notes: nextNotes,
            archived: nextArchived ? 1 : 0,
            updated_at: updatedAt,
        });
        if (payload.aliases) {
            var removeStmt_1 = this.db.prepare('DELETE FROM aliases WHERE product_id = ?');
            var insertAlias_2 = this.db.prepare('INSERT INTO aliases (product_id, label) VALUES (@product_id, @label)');
            var transaction = this.db.transaction(function (aliases) {
                removeStmt_1.run(payload.id);
                for (var _i = 0, aliases_2 = aliases; _i < aliases_2.length; _i++) {
                    var label = aliases_2[_i];
                    var trimmed = label.trim();
                    if (trimmed) {
                        insertAlias_2.run({ product_id: payload.id, label: trimmed });
                    }
                }
            });
            transaction(payload.aliases);
        }
        if (payload.accessoryIds) {
            this.upsertAccessories(payload.id, payload.accessoryIds, ownerId);
        }
        var updated = this.db.prepare('SELECT * FROM products WHERE id = ?').get(payload.id);
        // Логируем операцию
        this.logAuditEvent(ownerId, 'update', 'product', payload.id, JSON.stringify({ changes: Object.keys(payload) }));
        return __assign(__assign({}, this.mapProduct(updated)), { aliases: (_g = this.loadAliases(ownerId, [payload.id])[payload.id]) !== null && _g !== void 0 ? _g : [], accessories: (_h = this.loadAccessories([payload.id], ownerId)[payload.id]) !== null && _h !== void 0 ? _h : [], stock: (_j = this.getStockByProduct([payload.id], ownerId)[payload.id]) !== null && _j !== void 0 ? _j : emptyStock });
    };
    InventoryDatabase.prototype.listOperations = function (userId) {
        var _this = this;
        var ownerId = this.resolveUserId(userId);
        var rows = this.db
            .prepare("\n        SELECT\n          o.*,\n          p.name as product_name,\n          p.sku as product_sku,\n          b.title as bundle_title,\n          b.customer as bundle_customer,\n          b.note as bundle_note,\n          r.customer as reservation_customer,\n          r.contact as reservation_contact,\n          r.status as reservation_status,\n          r.quantity as reservation_quantity,\n          r.due_at as reservation_due_at,\n          r.comment as reservation_comment,\n          r.link_code as reservation_link_code,\n          r.created_at as reservation_created_at,\n          r.updated_at as reservation_updated_at\n        FROM operations o\n        LEFT JOIN products p ON p.id = o.product_id AND p.user_id = @userId\n        LEFT JOIN bundles b ON b.id = o.bundle_id AND b.user_id = @userId\n        LEFT JOIN reservations r ON r.id = o.reservation_id AND r.user_id = @userId\n        WHERE o.user_id = @userId\n        ORDER BY datetime(o.occurred_at) DESC, o.id DESC\n      ")
            .all({ userId: ownerId });
        return rows.map(function (row) { return _this.mapOperation(row); });
    };
    InventoryDatabase.prototype.createOperation = function (payload, userId) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
        var ownerId = this.resolveUserId(userId);
        var product = this.db.prepare('SELECT * FROM products WHERE id = ?').get(payload.productId);
        if (!product) {
            throw new Error('Товар не найден');
        }
        if (!allowedOperationTypes.includes(payload.type)) {
            throw new Error('Неизвестный тип операции');
        }
        if (product.user_id && product.user_id !== ownerId) {
            console.warn("\u26A0\uFE0F \u041F\u043E\u043F\u044B\u0442\u043A\u0430 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438 \u0434\u043B\u044F \u0442\u043E\u0432\u0430\u0440\u0430 ".concat(payload.productId, " \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F ").concat(product.user_id, " \u043E\u0442 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F ").concat(ownerId));
            throw new Error('Нет доступа к товару');
        }
        if (payload.quantity <= 0) {
            throw new Error('Количество должно быть больше 0');
        }
        var customer = (_b = (_a = payload.customer) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : '';
        if (['ship_on_credit', 'close_debt'].includes(payload.type) && !customer) {
            throw new Error('Укажите клиента для операций с долгом');
        }
        if (payload.type === 'close_debt') {
            var currentDebt = this.getCustomerDebt(payload.productId, customer, ownerId);
            if (currentDebt <= 0) {
                throw new Error('Долг для этого клиента отсутствует');
            }
            if (payload.quantity > currentDebt) {
                throw new Error('Сумма погашения превышает остаток долга');
            }
        }
        var contact = (_d = (_c = payload.contact) === null || _c === void 0 ? void 0 : _c.trim()) !== null && _d !== void 0 ? _d : '';
        var reservationId = (_e = payload.reservationId) !== null && _e !== void 0 ? _e : null;
        var bundleTitle = ((_f = payload.bundleTitle) === null || _f === void 0 ? void 0 : _f.trim()) || null;
        var bundleId = (_g = payload.bundleId) !== null && _g !== void 0 ? _g : null;
        var dueAt = (_h = payload.dueAt) !== null && _h !== void 0 ? _h : null;
        var permitNumber = ((_j = payload.permitNumber) === null || _j === void 0 ? void 0 : _j.trim()) || null;
        var paid = (_k = payload.paid) !== null && _k !== void 0 ? _k : (['sale', 'sale_from_reserve', 'close_debt'].includes(payload.type)
            ? true
            : payload.type === 'ship_on_credit'
                ? false
                : false);
        var occurred = (_l = payload.occurredAt) !== null && _l !== void 0 ? _l : new Date().toISOString();
        var now = occurred;
        if (payload.type === 'reserve') {
            var linkCode = "BR-".concat(Date.now().toString(36), "-").concat(Math.floor(Math.random() * 1000));
            var insertReserve = this.db.prepare("\n        INSERT INTO reservations (product_id, quantity, customer, contact, status, due_at, comment, link_code, created_at, updated_at, user_id)\n        VALUES (@product_id, @quantity, @customer, @contact, 'active', @due_at, @comment, @link_code, @created_at, @updated_at, @user_id)\n      ");
            var resResult = insertReserve.run({
                product_id: payload.productId,
                quantity: payload.quantity,
                customer: customer || null,
                contact: contact || null,
                due_at: dueAt,
                comment: (_m = payload.comment) !== null && _m !== void 0 ? _m : null,
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
            var reservation = this.db
                .prepare('SELECT * FROM reservations WHERE id = ?')
                .get(reservationId);
            if (!reservation) {
                throw new Error('Бронь не найдена');
            }
            var nextStatus = payload.type === 'sale_from_reserve' ? 'sold' : 'released';
            this.db
                .prepare('UPDATE reservations SET status = ?, updated_at = ? WHERE id = ?')
                .run(nextStatus, now, reservationId);
        }
        if (!bundleId && bundleTitle) {
            var bundleInsert = this.db.prepare('INSERT INTO bundles (title, customer, note, created_at, user_id) VALUES (@title, @customer, @note, @created_at, @user_id)');
            var bundleResult = bundleInsert.run({
                title: bundleTitle,
                customer: customer || contact || null,
                note: (_o = payload.comment) !== null && _o !== void 0 ? _o : null,
                created_at: now,
                user_id: ownerId,
            });
            bundleId = Number(bundleResult.lastInsertRowid);
        }
        var insert = this.db.prepare("\n      INSERT INTO operations (product_id, type, quantity, customer, contact, permit_number, paid, reservation_id, bundle_id, due_at, comment, occurred_at, user_id)\n      VALUES (@product_id, @type, @quantity, @customer, @contact, @permit_number, @paid, @reservation_id, @bundle_id, @due_at, @comment, @occurred_at, @user_id)\n    ");
        var result = insert.run({
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
            comment: (_p = payload.comment) !== null && _p !== void 0 ? _p : null,
            occurred_at: occurred,
            user_id: ownerId,
        });
        this.db.prepare('UPDATE products SET updated_at = ? WHERE id = ?').run(occurred, payload.productId);
        var created = this.db
            .prepare("\n        SELECT\n          o.*,\n          p.name as product_name,\n          p.sku as product_sku,\n          b.title as bundle_title,\n          b.customer as bundle_customer,\n          b.note as bundle_note,\n          r.customer as reservation_customer,\n          r.contact as reservation_contact,\n          r.status as reservation_status,\n          r.quantity as reservation_quantity,\n          r.due_at as reservation_due_at,\n          r.comment as reservation_comment,\n          r.link_code as reservation_link_code,\n          r.created_at as reservation_created_at,\n          r.updated_at as reservation_updated_at\n        FROM operations o\n        LEFT JOIN products p ON p.id = o.product_id AND p.user_id = ?\n        LEFT JOIN bundles b ON b.id = o.bundle_id AND b.user_id = ?\n        LEFT JOIN reservations r ON r.id = o.reservation_id AND r.user_id = ?\n        WHERE o.id = ? AND o.user_id = ?\n      ")
            .get(ownerId, ownerId, ownerId, result.lastInsertRowid, ownerId);
        var operationResult = this.mapOperation(created);
        // Логируем операцию
        this.logAuditEvent(ownerId, 'create', 'operation', operationResult.id, JSON.stringify({ type: payload.type, productId: payload.productId, quantity: payload.quantity }));
        // Автоматическое создание напоминаний
        // 1. Если создана бронь с датой окончания - напомнить за день до
        if (payload.type === 'reserve' && reservationId && dueAt) {
            var dueDate = new Date(dueAt);
            var reminderDate = new Date(dueDate);
            reminderDate.setDate(reminderDate.getDate() - 1); // За день до окончания
            // Создаем напоминание только если дата в будущем
            if (reminderDate > new Date()) {
                var reminderTitle = "\u0411\u0440\u043E\u043D\u044C \u0438\u0441\u0442\u0435\u043A\u0430\u0435\u0442: ".concat((_q = product === null || product === void 0 ? void 0 : product.name) !== null && _q !== void 0 ? _q : 'Товар');
                var reminderMessage = "\u0411\u0440\u043E\u043D\u044C #".concat(reservationId, " (").concat(customer || 'Клиент', ") \u0438\u0441\u0442\u0435\u043A\u0430\u0435\u0442 \u0437\u0430\u0432\u0442\u0440\u0430. ").concat(contact ? "\u041A\u043E\u043D\u0442\u0430\u043A\u0442: ".concat(contact) : '');
                this.createReminder({
                    title: reminderTitle,
                    message: reminderMessage,
                    dueAt: reminderDate.toISOString(),
                    targetType: 'reservation',
                    targetId: reservationId,
                }, ownerId);
            }
        }
        // 2. Если отгрузка в долг - напомнить через 7 дней проверить оплату
        if (payload.type === 'ship_on_credit' && customer) {
            var reminderDate = new Date();
            reminderDate.setDate(reminderDate.getDate() + 7); // Через 7 дней
            var reminderTitle = "\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443 \u0434\u043E\u043B\u0433\u0430: ".concat(customer);
            var reminderMessage = "\u041E\u0442\u0433\u0440\u0443\u0436\u0435\u043D\u043E \u0432 \u0434\u043E\u043B\u0433: ".concat((_r = product === null || product === void 0 ? void 0 : product.name) !== null && _r !== void 0 ? _r : 'Товар', " (").concat(payload.quantity, " \u0448\u0442.). \u041A\u043B\u0438\u0435\u043D\u0442: ").concat(customer, ". ").concat(contact ? "\u041A\u043E\u043D\u0442\u0430\u043A\u0442: ".concat(contact) : '');
            this.createReminder({
                title: reminderTitle,
                message: reminderMessage,
                dueAt: reminderDate.toISOString(),
                targetType: 'operation',
                targetId: operationResult.id,
            }, ownerId);
        }
        return operationResult;
    };
    InventoryDatabase.prototype.deleteOperation = function (id, userId) {
        var ownerId = this.resolveUserId(userId);
        var existing = this.db.prepare('SELECT * FROM operations WHERE id = ?').get(id);
        if (!existing)
            return;
        if (existing.user_id && existing.user_id !== ownerId) {
            console.warn("\u26A0\uFE0F \u041F\u043E\u043F\u044B\u0442\u043A\u0430 \u0443\u0434\u0430\u043B\u0435\u043D\u0438\u044F \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438 ".concat(id, " \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F ").concat(existing.user_id, " \u043E\u0442 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F ").concat(ownerId));
            throw new Error('Нет доступа к операции');
        }
        // Логируем операцию
        this.logAuditEvent(ownerId, 'delete', 'operation', id, JSON.stringify({ type: existing.type, productId: existing.product_id }));
        this.db.prepare('DELETE FROM operations WHERE id = ?').run(id);
        this.db
            .prepare('UPDATE products SET updated_at = ? WHERE id = ?')
            .run(new Date().toISOString(), existing.product_id);
    };
    InventoryDatabase.prototype.deleteProduct = function (id, userId) {
        var _this = this;
        var ownerId = this.resolveUserId(userId);
        var product = this.db.prepare('SELECT * FROM products WHERE id = ?').get(id);
        if (!product)
            return;
        if (product.user_id && product.user_id !== ownerId) {
            console.warn("\u26A0\uFE0F \u041F\u043E\u043F\u044B\u0442\u043A\u0430 \u0443\u0434\u0430\u043B\u0435\u043D\u0438\u044F \u0442\u043E\u0432\u0430\u0440\u0430 ".concat(id, " \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F ").concat(product.user_id, " \u043E\u0442 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F ").concat(ownerId));
            throw new Error('Нет доступа к товару');
        }
        var count = this.db
            .prepare('SELECT COUNT(*) as count FROM operations WHERE product_id = ? AND user_id = ?')
            .get(id, ownerId).count;
        if (count > 0) {
            throw new Error('Товар используется в операциях и не может быть удален');
        }
        // Логируем операцию перед удалением
        this.logAuditEvent(ownerId, 'delete', 'product', id, JSON.stringify({ productName: product.name }));
        var remove = this.db.transaction(function (productId) {
            _this.db.prepare('DELETE FROM aliases WHERE product_id = ?').run(productId);
            _this.db.prepare('DELETE FROM products WHERE id = ?').run(productId);
        });
        remove(id);
    };
    InventoryDatabase.prototype.getDashboard = function (userId) {
        var _a;
        var ownerId = this.resolveUserId(userId);
        var products = this.listProducts(ownerId);
        var lowStock = products.filter(function (p) { return !p.archived && p.minStock > 0 && p.stock.available < p.minStock; });
        var totalReserved = products.reduce(function (sum, p) { return sum + p.stock.reserved; }, 0);
        var debtRows = (_a = this.db
            .prepare("\n        SELECT product_id as productId, customer, SUM(\n          CASE\n            WHEN type = 'ship_on_credit' THEN quantity\n            WHEN type = 'close_debt' THEN -quantity\n            ELSE 0\n          END\n        ) as debt\n        FROM operations\n        WHERE customer IS NOT NULL AND user_id = @userId\n        GROUP BY product_id, customer\n        HAVING debt > 0\n      ")
            .all({ userId: ownerId })) !== null && _a !== void 0 ? _a : [];
        var productMap = new Map(products.map(function (p) { return [p.id, p]; }));
        return {
            lowStock: lowStock,
            totalReserved: totalReserved,
            activeDebts: debtRows.map(function (row) {
                var _a, _b;
                return ({
                    productId: row.productId,
                    customer: row.customer,
                    debt: row.debt,
                    productName: (_b = (_a = productMap.get(row.productId)) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : 'Неизвестно',
                });
            }),
        };
    };
    InventoryDatabase.prototype.listReservations = function (userId) {
        var _a;
        var ownerId = this.resolveUserId(userId);
        var rows = (_a = this.db
            .prepare("\n        SELECT r.*, p.name as product_name, p.sku as product_sku\n        FROM reservations r\n        LEFT JOIN products p ON p.id = r.product_id AND p.user_id = @userId\n        WHERE r.user_id = @userId\n        ORDER BY datetime(r.due_at) ASC, r.id DESC\n      ")
            .all({ userId: ownerId })) !== null && _a !== void 0 ? _a : [];
        return rows.map(function (row) {
            var _a, _b, _c, _d, _e, _f;
            var status = row.status === 'active' && row.due_at && new Date(row.due_at) < new Date()
                ? 'expired'
                : row.status;
            return {
                id: row.id,
                productId: row.product_id,
                quantity: row.quantity,
                customer: (_a = row.customer) !== null && _a !== void 0 ? _a : undefined,
                contact: (_b = row.contact) !== null && _b !== void 0 ? _b : undefined,
                status: status,
                dueAt: (_c = row.due_at) !== null && _c !== void 0 ? _c : undefined,
                comment: (_d = row.comment) !== null && _d !== void 0 ? _d : undefined,
                linkCode: row.link_code,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                product: {
                    id: row.product_id,
                    name: (_e = row.product_name) !== null && _e !== void 0 ? _e : 'Товар',
                    sku: (_f = row.product_sku) !== null && _f !== void 0 ? _f : undefined,
                },
            };
        });
    };
    InventoryDatabase.prototype.updateReservation = function (payload, userId) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        var ownerId = this.resolveUserId(userId);
        var existing = this.db
            .prepare('SELECT * FROM reservations WHERE id = ?')
            .get(payload.id);
        if (!existing) {
            throw new Error('Бронь не найдена');
        }
        if (existing.user_id && existing.user_id !== ownerId) {
            console.warn("\u26A0\uFE0F \u041F\u043E\u043F\u044B\u0442\u043A\u0430 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u0431\u0440\u043E\u043D\u0438 ".concat(payload.id, " \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F ").concat(existing.user_id, " \u043E\u0442 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F ").concat(ownerId));
            throw new Error('Нет доступа к брони');
        }
        var nextStatus = (_a = payload.status) !== null && _a !== void 0 ? _a : existing.status;
        var updateStmt = this.db.prepare("\n      UPDATE reservations\n      SET customer = @customer,\n          contact = @contact,\n          status = @status,\n          due_at = @due_at,\n          comment = @comment,\n          updated_at = @updated_at\n      WHERE id = @id\n    ");
        var updatedAt = new Date().toISOString();
        updateStmt.run({
            id: payload.id,
            customer: (_b = payload.customer) !== null && _b !== void 0 ? _b : existing.customer,
            contact: (_c = payload.contact) !== null && _c !== void 0 ? _c : existing.contact,
            status: nextStatus,
            due_at: (_d = payload.dueAt) !== null && _d !== void 0 ? _d : existing.due_at,
            comment: (_e = payload.comment) !== null && _e !== void 0 ? _e : existing.comment,
            updated_at: updatedAt,
        });
        var row = this.db
            .prepare("\n        SELECT r.*, p.name as product_name, p.sku as product_sku\n        FROM reservations r\n        LEFT JOIN products p ON p.id = r.product_id AND p.user_id = r.user_id\n        WHERE r.id = ?\n      ")
            .get(payload.id);
        if (!row) {
            throw new Error('Не удалось обновить бронь');
        }
        var status = row.status === 'active' && row.due_at && new Date(row.due_at) < new Date()
            ? 'expired'
            : row.status;
        return {
            id: row.id,
            productId: row.product_id,
            quantity: row.quantity,
            customer: (_f = row.customer) !== null && _f !== void 0 ? _f : undefined,
            contact: (_g = row.contact) !== null && _g !== void 0 ? _g : undefined,
            status: status,
            dueAt: (_h = row.due_at) !== null && _h !== void 0 ? _h : undefined,
            comment: (_j = row.comment) !== null && _j !== void 0 ? _j : undefined,
            linkCode: row.link_code,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            product: {
                id: row.product_id,
                name: (_k = row.product_name) !== null && _k !== void 0 ? _k : 'Товар',
                sku: (_l = row.product_sku) !== null && _l !== void 0 ? _l : undefined,
            },
        };
    };
    InventoryDatabase.prototype.listReminders = function (userId) {
        var _a;
        var ownerId = this.resolveUserId(userId);
        var rows = (_a = this.db
            .prepare('SELECT * FROM reminders WHERE user_id = @userId ORDER BY done ASC, datetime(due_at) ASC')
            .all({ userId: ownerId })) !== null && _a !== void 0 ? _a : [];
        return rows.map(function (row) {
            var _a, _b, _c;
            return ({
                id: row.id,
                title: row.title,
                message: (_a = row.message) !== null && _a !== void 0 ? _a : undefined,
                dueAt: row.due_at,
                done: Boolean(row.done),
                targetType: (_b = row.target_type) !== null && _b !== void 0 ? _b : null,
                targetId: (_c = row.target_id) !== null && _c !== void 0 ? _c : null,
                createdAt: row.created_at,
            });
        });
    };
    InventoryDatabase.prototype.createReminder = function (payload, userId) {
        var _a, _b, _c, _d, _e, _f;
        var ownerId = this.resolveUserId(userId);
        var insert = this.db.prepare("\n      INSERT INTO reminders (title, message, due_at, done, target_type, target_id, created_at, user_id)\n      VALUES (@title, @message, @due_at, 0, @target_type, @target_id, @created_at, @user_id)\n    ");
        var now = new Date().toISOString();
        var result = insert.run({
            title: payload.title,
            message: (_a = payload.message) !== null && _a !== void 0 ? _a : null,
            due_at: payload.dueAt,
            target_type: (_b = payload.targetType) !== null && _b !== void 0 ? _b : null,
            target_id: (_c = payload.targetId) !== null && _c !== void 0 ? _c : null,
            created_at: now,
            user_id: ownerId,
        });
        return {
            id: Number(result.lastInsertRowid),
            title: payload.title,
            message: (_d = payload.message) !== null && _d !== void 0 ? _d : undefined,
            dueAt: payload.dueAt,
            done: false,
            targetType: (_e = payload.targetType) !== null && _e !== void 0 ? _e : null,
            targetId: (_f = payload.targetId) !== null && _f !== void 0 ? _f : null,
            createdAt: now,
        };
    };
    InventoryDatabase.prototype.updateReminder = function (payload, userId) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        var ownerId = this.resolveUserId(userId);
        var existing = this.db
            .prepare('SELECT * FROM reminders WHERE id = ?')
            .get(payload.id);
        if (!existing) {
            throw new Error('Напоминание не найдено');
        }
        if (existing.user_id && existing.user_id !== ownerId) {
            console.warn("\u26A0\uFE0F \u041F\u043E\u043F\u044B\u0442\u043A\u0430 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u043D\u0430\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u044F ".concat(payload.id, " \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F ").concat(existing.user_id, " \u043E\u0442 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F ").concat(ownerId));
            throw new Error('Нет доступа к напоминанию');
        }
        var update = this.db.prepare("\n      UPDATE reminders\n      SET title = @title,\n          message = @message,\n      due_at = @due_at,\n      done = @done,\n      target_type = @target_type,\n      target_id = @target_id\n      WHERE id = @id\n    ");
        update.run({
            id: payload.id,
            title: (_a = payload.title) !== null && _a !== void 0 ? _a : existing.title,
            message: (_b = payload.message) !== null && _b !== void 0 ? _b : existing.message,
            due_at: (_c = payload.dueAt) !== null && _c !== void 0 ? _c : existing.due_at,
            done: ((_d = payload.done) !== null && _d !== void 0 ? _d : Boolean(existing.done)) ? 1 : 0,
            target_type: (_e = payload.targetType) !== null && _e !== void 0 ? _e : existing.target_type,
            target_id: (_f = payload.targetId) !== null && _f !== void 0 ? _f : existing.target_id,
        });
        var updated = this.db
            .prepare('SELECT * FROM reminders WHERE id = ?')
            .get(payload.id);
        return {
            id: updated.id,
            title: updated.title,
            message: (_g = updated.message) !== null && _g !== void 0 ? _g : undefined,
            dueAt: updated.due_at,
            done: Boolean(updated.done),
            targetType: (_h = updated.target_type) !== null && _h !== void 0 ? _h : null,
            targetId: (_j = updated.target_id) !== null && _j !== void 0 ? _j : null,
            createdAt: updated.created_at,
        };
    };
    InventoryDatabase.prototype.loadAliases = function (userId, productIds) {
        var _a;
        var ownerId = this.resolveUserId(userId);
        var query = "\n      SELECT a.id, a.product_id, a.label\n      FROM aliases a\n      INNER JOIN products p ON p.id = a.product_id\n      WHERE p.user_id = ?\n    ";
        var params = [ownerId];
        if (productIds === null || productIds === void 0 ? void 0 : productIds.length) {
            query += " AND a.product_id IN (".concat(productIds.map(function () { return '?'; }).join(','), ")");
            params.push.apply(params, productIds);
        }
        var rows = (_a = this.db.prepare(query)).all.apply(_a, params);
        return rows.reduce(function (acc, row) {
            var _a;
            acc[row.product_id] = (_a = acc[row.product_id]) !== null && _a !== void 0 ? _a : [];
            acc[row.product_id].push({
                id: row.id,
                productId: row.product_id,
                label: row.label,
            });
            return acc;
        }, {});
    };
    InventoryDatabase.prototype.loadAccessories = function (productIds, userId) {
        var _a;
        var _b;
        var ownerId = this.resolveUserId(userId);
        var query = "\n      SELECT pa.id, pa.product_id, pa.accessory_id, p.name as accessory_name, p.sku as accessory_sku\n      FROM product_accessories pa\n      INNER JOIN products p_product ON p_product.id = pa.product_id\n      LEFT JOIN products p ON p.id = pa.accessory_id AND p.user_id = ?\n      WHERE p_product.user_id = ?\n    ";
        var params = [ownerId, ownerId];
        if (productIds === null || productIds === void 0 ? void 0 : productIds.length) {
            query += " AND pa.product_id IN (".concat(productIds.map(function () { return '?'; }).join(','), ")");
            params.push.apply(params, productIds);
        }
        var rows = (_b = (_a = this.db
            .prepare(query))
            .all.apply(_a, params)) !== null && _b !== void 0 ? _b : [];
        return rows.reduce(function (acc, row) {
            var _a, _b;
            acc[row.product_id] = (_a = acc[row.product_id]) !== null && _a !== void 0 ? _a : [];
            acc[row.product_id].push({
                id: row.id,
                productId: row.product_id,
                accessoryId: row.accessory_id,
                accessoryName: (_b = row.accessory_name) !== null && _b !== void 0 ? _b : 'Аксессуар',
                accessorySku: row.accessory_sku,
            });
            return acc;
        }, {});
    };
    InventoryDatabase.prototype.upsertAccessories = function (productId, accessoryIds, userId) {
        var _a;
        var ownerId = this.resolveUserId(userId);
        // Проверяем, что productId принадлежит пользователю
        var product = this.db.prepare('SELECT user_id FROM products WHERE id = ?').get(productId);
        if (!product || product.user_id !== ownerId) {
            throw new Error('Нет доступа к товару');
        }
        // Проверяем, что все accessoryIds принадлежат тому же пользователю
        if (accessoryIds.length > 0) {
            var placeholders = accessoryIds.map(function () { return '?'; }).join(',');
            var accessories = (_a = this.db
                .prepare("SELECT id, user_id FROM products WHERE id IN (".concat(placeholders, ")")))
                .all.apply(_a, accessoryIds);
            var invalidAccessories = accessories.filter(function (a) { return a.user_id !== ownerId; });
            if (invalidAccessories.length > 0) {
                throw new Error('Некоторые аксессуары принадлежат другому пользователю');
            }
            // Проверяем, что все переданные accessoryIds найдены в БД
            var foundIds_1 = new Set(accessories.map(function (a) { return a.id; }));
            var missingIds = accessoryIds.filter(function (id) { return !foundIds_1.has(id); });
            if (missingIds.length > 0) {
                throw new Error('Некоторые аксессуары не найдены');
            }
        }
        var uniqueIds = Array.from(new Set(accessoryIds.filter(function (id) { return id !== productId; })));
        var removeStmt = this.db.prepare('DELETE FROM product_accessories WHERE product_id = ?');
        var insertStmt = this.db.prepare("\n      INSERT OR IGNORE INTO product_accessories (product_id, accessory_id) VALUES (@product_id, @accessory_id)\n    ");
        var tx = this.db.transaction(function () {
            removeStmt.run(productId);
            for (var _i = 0, uniqueIds_1 = uniqueIds; _i < uniqueIds_1.length; _i++) {
                var accessoryId = uniqueIds_1[_i];
                insertStmt.run({ product_id: productId, accessory_id: accessoryId });
            }
        });
        tx();
    };
    InventoryDatabase.prototype.mapProduct = function (row) {
        var _a;
        return {
            id: row.id,
            name: row.name,
            sku: row.sku,
            model: row.model,
            minStock: (_a = row.min_stock) !== null && _a !== void 0 ? _a : 0,
            hasImportPermit: Boolean(row.has_import_permit),
            notes: row.notes,
            archived: Boolean(row.archived),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            aliases: [],
            accessories: [],
        };
    };
    InventoryDatabase.prototype.mapOperation = function (row) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        var reservationStatus = row.reservation_status === 'active' && row.reservation_due_at
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
            permitNumber: (_a = row.permit_number) !== null && _a !== void 0 ? _a : undefined,
            paid: Boolean(row.paid),
            reservationId: (_b = row.reservation_id) !== null && _b !== void 0 ? _b : null,
            bundleId: (_c = row.bundle_id) !== null && _c !== void 0 ? _c : null,
            dueAt: (_d = row.due_at) !== null && _d !== void 0 ? _d : null,
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
                    quantity: (_e = row.reservation_quantity) !== null && _e !== void 0 ? _e : row.quantity,
                    customer: row.reservation_customer,
                    contact: row.reservation_contact,
                    status: (reservationStatus !== null && reservationStatus !== void 0 ? reservationStatus : 'active'),
                    dueAt: row.reservation_due_at,
                    comment: row.reservation_comment,
                    linkCode: (_f = row.reservation_link_code) !== null && _f !== void 0 ? _f : '',
                    createdAt: (_g = row.reservation_created_at) !== null && _g !== void 0 ? _g : row.created_at,
                    updatedAt: (_h = row.reservation_updated_at) !== null && _h !== void 0 ? _h : row.created_at,
                    product: {
                        id: row.product_id,
                        name: (_j = row.product_name) !== null && _j !== void 0 ? _j : 'Товар',
                        sku: (_k = row.product_sku) !== null && _k !== void 0 ? _k : undefined,
                    },
                }
                : null,
            product: {
                id: row.product_id,
                name: (_l = row.product_name) !== null && _l !== void 0 ? _l : 'Товар',
                sku: (_m = row.product_sku) !== null && _m !== void 0 ? _m : undefined,
            },
        };
    };
    InventoryDatabase.prototype.getCustomerDebt = function (productId, customer, userId) {
        var _a;
        var ownerId = this.resolveUserId(userId);
        if (!customer)
            return 0;
        var row = this.db
            .prepare("\n      SELECT SUM(\n        CASE\n          WHEN type = 'ship_on_credit' THEN quantity\n          WHEN type = 'close_debt' THEN -quantity\n          ELSE 0\n        END\n      ) as debt\n      FROM operations\n      WHERE product_id = ? AND lower(trim(customer)) = lower(trim(?)) AND user_id = ?\n    ")
            .get(productId, customer, ownerId);
        return (_a = row === null || row === void 0 ? void 0 : row.debt) !== null && _a !== void 0 ? _a : 0;
    };
    InventoryDatabase.prototype.getStockByProduct = function (productIds, userId) {
        var _a;
        var _b, _c, _d, _e, _f;
        var ownerId = this.resolveUserId(userId);
        var filter = (productIds === null || productIds === void 0 ? void 0 : productIds.length) ? "WHERE product_id IN (".concat(productIds.map(function () { return '?'; }).join(','), ")") : '';
        var params = (productIds === null || productIds === void 0 ? void 0 : productIds.length) ? __spreadArray(__spreadArray([], productIds, true), [ownerId], false) : [ownerId];
        var rows = (_b = ((_a = this.db
            .prepare("\n        SELECT\n          product_id as productId,\n          SUM(\n            CASE\n              WHEN type = 'purchase' THEN quantity\n              WHEN type = 'return' THEN quantity\n              WHEN type = 'sale' THEN -quantity\n              WHEN type = 'sale_from_reserve' THEN -quantity\n              WHEN type = 'ship_on_credit' THEN -quantity\n              ELSE 0\n            END\n          ) as onHand,\n          SUM(\n            CASE\n              WHEN type = 'reserve' THEN quantity\n              WHEN type = 'reserve_release' THEN -quantity\n              WHEN type = 'sale_from_reserve' THEN -quantity\n              ELSE 0\n            END\n          ) as reserved,\n          SUM(\n            CASE\n              WHEN type = 'ship_on_credit' THEN quantity\n              WHEN type = 'close_debt' THEN -quantity\n              ELSE 0\n            END\n          ) as debt\n        FROM operations\n        ".concat(filter ? "".concat(filter, " AND user_id = ?") : 'WHERE user_id = ?', "\n        GROUP BY product_id\n      ")))
            .all.apply(_a, params))) !== null && _b !== void 0 ? _b : [];
        var stockByProduct = {};
        for (var _i = 0, _g = rows; _i < _g.length; _i++) {
            var row = _g[_i];
            var onHand = (_c = row.onHand) !== null && _c !== void 0 ? _c : 0;
            var reserved = (_d = row.reserved) !== null && _d !== void 0 ? _d : 0;
            var debt = (_e = row.debt) !== null && _e !== void 0 ? _e : 0;
            stockByProduct[row.productId] = {
                onHand: onHand,
                reserved: reserved,
                debt: debt,
                balance: onHand,
                available: onHand - reserved,
            };
        }
        if (productIds === null || productIds === void 0 ? void 0 : productIds.length) {
            for (var _h = 0, productIds_1 = productIds; _h < productIds_1.length; _h++) {
                var id = productIds_1[_h];
                stockByProduct[id] = (_f = stockByProduct[id]) !== null && _f !== void 0 ? _f : __assign({}, emptyStock);
            }
        }
        return stockByProduct;
    };
    // ----- Users & Auth -----
    InventoryDatabase.prototype.login = function (payload, ipAddress, userAgent) {
        var userRow = this.db
            .prepare('SELECT * FROM users WHERE lower(username) = lower(?)')
            .get(payload.username);
        if (!userRow) {
            this.logAuditEvent(0, 'login_failed', 'user', null, JSON.stringify({ username: payload.username, reason: 'user_not_found' }), ipAddress, userAgent);
            throw new Error('Неверный логин или пароль');
        }
        var valid = bcrypt.compareSync(payload.password, userRow.password_hash);
        if (!valid) {
            this.logAuditEvent(userRow.id, 'login_failed', 'user', userRow.id, JSON.stringify({ username: payload.username, reason: 'invalid_password' }), ipAddress, userAgent);
            throw new Error('Неверный логин или пароль');
        }
        var session = this.createSession(userRow.id, 30);
        // Логируем успешный вход
        this.logAuditEvent(userRow.id, 'login', 'user', userRow.id, JSON.stringify({ username: payload.username }), ipAddress, userAgent);
        return { user: this.mapUser(userRow), session: session };
    };
    InventoryDatabase.prototype.createSession = function (userId, days) {
        if (days === void 0) { days = 30; }
        var token = crypto.randomBytes(32).toString('hex');
        var expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
        var now = new Date().toISOString();
        var result = this.db
            .prepare('INSERT INTO sessions (user_id, token, expires_at, created_at) VALUES (@user_id, @token, @expires_at, @created_at)')
            .run({
            user_id: userId,
            token: token,
            expires_at: expiresAt,
            created_at: now,
        });
        return {
            id: Number(result.lastInsertRowid),
            userId: userId,
            token: token,
            expiresAt: expiresAt,
            createdAt: now,
        };
    };
    InventoryDatabase.prototype.getSessionByToken = function (token) {
        if (!token)
            return null;
        var row = this.db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
        if (!row)
            return null;
        return {
            id: row.id,
            userId: row.user_id,
            token: row.token,
            expiresAt: row.expires_at,
            createdAt: row.created_at,
        };
    };
    InventoryDatabase.prototype.deleteSession = function (token) {
        if (!token)
            return;
        this.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    };
    InventoryDatabase.prototype.refreshSession = function (token, days) {
        if (days === void 0) { days = 30; }
        var session = this.getSessionByToken(token);
        if (!session)
            return null;
        // Обновляем срок действия сессии
        var newExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
        this.db
            .prepare('UPDATE sessions SET expires_at = ? WHERE token = ?')
            .run(newExpiresAt, token);
        return __assign(__assign({}, session), { expiresAt: newExpiresAt });
    };
    InventoryDatabase.prototype.logAuditEvent = function (userId, actionType, entityType, entityId, details, ipAddress, userAgent) {
        if (entityId === void 0) { entityId = null; }
        if (details === void 0) { details = null; }
        if (ipAddress === void 0) { ipAddress = null; }
        if (userAgent === void 0) { userAgent = null; }
        this.db
            .prepare('INSERT INTO audit_log (user_id, action_type, entity_type, entity_id, details, ip_address, user_agent, created_at) VALUES (@user_id, @action_type, @entity_type, @entity_id, @details, @ip_address, @user_agent, @created_at)')
            .run({
            user_id: userId,
            action_type: actionType,
            entity_type: entityType,
            entity_id: entityId,
            details: details,
            ip_address: ipAddress,
            user_agent: userAgent,
            created_at: new Date().toISOString(),
        });
    };
    InventoryDatabase.prototype.getUserById = function (id) {
        var row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        return row ? this.mapUser(row) : null;
    };
    InventoryDatabase.prototype.listUsers = function () {
        var _this = this;
        var rows = this.db.prepare('SELECT * FROM users ORDER BY id ASC').all();
        return rows.map(function (row) { return _this.mapUser(row); });
    };
    InventoryDatabase.prototype.createUser = function (payload) {
        var _a, _b;
        var username = payload.username.trim();
        if (!username) {
            throw new Error('Имя пользователя обязательно');
        }
        if (!payload.password) {
            throw new Error('Пароль обязателен');
        }
        var existing = this.db
            .prepare('SELECT id FROM users WHERE lower(username) = lower(?)')
            .get(username);
        if (existing) {
            throw new Error('Пользователь с таким именем уже существует');
        }
        var now = new Date().toISOString();
        var passwordHash = bcrypt.hashSync(payload.password, 10);
        var role = (_a = payload.role) !== null && _a !== void 0 ? _a : 'user';
        var result = this.db
            .prepare("INSERT INTO users (username, password_hash, role, email, created_at, updated_at)\n         VALUES (@username, @password_hash, @role, @email, @created_at, @updated_at)")
            .run({
            username: username,
            password_hash: passwordHash,
            role: role,
            email: (_b = payload.email) !== null && _b !== void 0 ? _b : null,
            created_at: now,
            updated_at: now,
        });
        return this.mapUser(this.db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid));
    };
    InventoryDatabase.prototype.updateUser = function (payload) {
        var _a, _b, _c, _d, _e, _f;
        var existing = this.db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
        if (!existing) {
            throw new Error('Пользователь не найден');
        }
        var nextUsername = ((_a = payload.username) === null || _a === void 0 ? void 0 : _a.trim()) || existing.username;
        var nextPasswordHash = payload.password ? bcrypt.hashSync(payload.password, 10) : existing.password_hash;
        var nextRole = (_b = payload.role) !== null && _b !== void 0 ? _b : existing.role;
        var nextEmail = (_c = payload.email) !== null && _c !== void 0 ? _c : existing.email;
        var updatedAt = new Date().toISOString();
        this.db
            .prepare("UPDATE users\n         SET username = @username,\n             password_hash = @password_hash,\n             role = @role,\n             email = @email,\n             google_drive_folder_id = @google_drive_folder_id,\n             google_drive_client_id = @google_drive_client_id,\n             google_drive_client_secret = @google_drive_client_secret,\n             updated_at = @updated_at\n         WHERE id = @id")
            .run({
            id: payload.id,
            username: nextUsername,
            password_hash: nextPasswordHash,
            role: nextRole,
            email: nextEmail !== null && nextEmail !== void 0 ? nextEmail : null,
            google_drive_folder_id: (_d = payload.googleDriveFolderId) !== null && _d !== void 0 ? _d : existing.google_drive_folder_id,
            google_drive_client_id: (_e = payload.googleDriveClientId) !== null && _e !== void 0 ? _e : existing.google_drive_client_id,
            google_drive_client_secret: (_f = payload.googleDriveClientSecret) !== null && _f !== void 0 ? _f : existing.google_drive_client_secret,
            updated_at: updatedAt,
        });
        var row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
        return this.mapUser(row);
    };
    InventoryDatabase.prototype.deleteUser = function (id) {
        var existing = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        if (!existing)
            return;
        if (existing.role === 'admin') {
            var admins = this.db
                .prepare("SELECT COUNT(*) as admins FROM users WHERE role = 'admin'")
                .get().admins;
            if (admins <= 1) {
                throw new Error('Нельзя удалить последнего администратора');
            }
        }
        this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
        this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    };
    InventoryDatabase.prototype.getUserGoogleDriveConfig = function (userId) {
        var user = this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!user)
            return null;
        return {
            clientId: user.google_drive_client_id,
            clientSecret: user.google_drive_client_secret,
            folderId: user.google_drive_folder_id,
            accessToken: null,
            refreshToken: null,
        };
    };
    InventoryDatabase.prototype.updateUserGoogleDriveConfig = function (userId, clientId, clientSecret, folderId) {
        var existing = this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!existing) {
            throw new Error('Пользователь не найден');
        }
        this.db
            .prepare("UPDATE users\n         SET google_drive_client_id = @clientId,\n             google_drive_client_secret = @clientSecret,\n             google_drive_folder_id = @folderId,\n             updated_at = @updated_at\n         WHERE id = @id")
            .run({
            id: userId,
            clientId: clientId,
            clientSecret: clientSecret,
            folderId: folderId !== null && folderId !== void 0 ? folderId : existing.google_drive_folder_id,
            updated_at: new Date().toISOString(),
        });
    };
    InventoryDatabase.prototype.exportSnapshot = function (includeUsers, userId) {
        if (includeUsers === void 0) { includeUsers = false; }
        var ownerId = this.resolveUserId(userId);
        var snapshot = {
            products: this.listProducts(ownerId),
            operations: this.listOperations(ownerId),
            reservations: this.listReservations(ownerId),
            reminders: this.listReminders(ownerId),
            bundles: this.listBundles(ownerId),
        };
        if (includeUsers) {
            var user = this.getUserById(ownerId);
            snapshot.users = user ? [user] : [];
        }
        return snapshot;
    };
    InventoryDatabase.prototype.importSnapshot = function (snapshot, userId) {
        var _this = this;
        var ownerId = this.resolveUserId(userId);
        var tx = this.db.transaction(function () {
            var _a;
            var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12;
            // Clean previous data for this user
            _this.db.prepare('DELETE FROM operations WHERE user_id = ?').run(ownerId);
            _this.db.prepare('DELETE FROM reservations WHERE user_id = ?').run(ownerId);
            _this.db.prepare('DELETE FROM reminders WHERE user_id = ?').run(ownerId);
            _this.db.prepare('DELETE FROM product_accessories WHERE product_id IN (SELECT id FROM products WHERE user_id = ?)').run(ownerId);
            _this.db.prepare('DELETE FROM aliases WHERE product_id IN (SELECT id FROM products WHERE user_id = ?)').run(ownerId);
            _this.db.prepare('DELETE FROM bundles WHERE user_id = ?').run(ownerId);
            _this.db.prepare('DELETE FROM products WHERE user_id = ?').run(ownerId);
            // Bundles
            if ((_b = snapshot.bundles) === null || _b === void 0 ? void 0 : _b.length) {
                var insertBundle = _this.db.prepare("INSERT OR REPLACE INTO bundles (id, user_id, title, customer, note, created_at)\n           VALUES (@id, @user_id, @title, @customer, @note, @created_at)");
                for (var _i = 0, _13 = snapshot.bundles; _i < _13.length; _i++) {
                    var bundle = _13[_i];
                    insertBundle.run({
                        id: bundle.id,
                        user_id: ownerId,
                        title: (_c = bundle.title) !== null && _c !== void 0 ? _c : null,
                        customer: (_d = bundle.customer) !== null && _d !== void 0 ? _d : null,
                        note: (_e = bundle.note) !== null && _e !== void 0 ? _e : null,
                        created_at: (_f = bundle.createdAt) !== null && _f !== void 0 ? _f : new Date().toISOString(),
                    });
                }
            }
            // Products
            var insertProduct = _this.db.prepare("INSERT OR REPLACE INTO products (id, user_id, name, sku, model, min_stock, has_import_permit, notes, archived, created_at, updated_at)\n         VALUES (@id, @user_id, @name, @sku, @model, @min_stock, @has_import_permit, @notes, @archived, @created_at, @updated_at)");
            var insertAlias = _this.db.prepare('INSERT INTO aliases (id, product_id, label) VALUES (@id, @product_id, @label)');
            var insertAccessory = _this.db.prepare('INSERT OR IGNORE INTO product_accessories (product_id, accessory_id) VALUES (@product_id, @accessory_id)');
            for (var _14 = 0, _15 = (_g = snapshot.products) !== null && _g !== void 0 ? _g : []; _14 < _15.length; _14++) {
                var product = _15[_14];
                insertProduct.run({
                    id: product.id,
                    user_id: ownerId,
                    name: product.name,
                    sku: (_h = product.sku) !== null && _h !== void 0 ? _h : null,
                    model: (_j = product.model) !== null && _j !== void 0 ? _j : null,
                    min_stock: (_k = product.minStock) !== null && _k !== void 0 ? _k : 0,
                    has_import_permit: product.hasImportPermit ? 1 : 0,
                    notes: (_l = product.notes) !== null && _l !== void 0 ? _l : null,
                    archived: product.archived ? 1 : 0,
                    created_at: (_m = product.createdAt) !== null && _m !== void 0 ? _m : new Date().toISOString(),
                    updated_at: (_o = product.updatedAt) !== null && _o !== void 0 ? _o : new Date().toISOString(),
                });
                if ((_p = product.aliases) === null || _p === void 0 ? void 0 : _p.length) {
                    for (var _16 = 0, _17 = product.aliases; _16 < _17.length; _16++) {
                        var alias = _17[_16];
                        insertAlias.run({
                            id: alias.id,
                            product_id: product.id,
                            label: alias.label,
                        });
                    }
                }
                if ((_q = product.accessories) === null || _q === void 0 ? void 0 : _q.length) {
                    // Проверяем, что все аксессуары принадлежат тому же пользователю
                    var accessoryIds = product.accessories.map(function (a) { return a.accessoryId; });
                    if (accessoryIds.length > 0) {
                        var placeholders = accessoryIds.map(function () { return '?'; }).join(',');
                        var accessories = (_a = _this.db
                            .prepare("SELECT id, user_id FROM products WHERE id IN (".concat(placeholders, ")")))
                            .all.apply(_a, accessoryIds);
                        var invalidAccessories = accessories.filter(function (a) { return a.user_id !== ownerId; });
                        if (invalidAccessories.length > 0) {
                            console.warn("\u26A0\uFE0F \u041F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u044B \u0430\u043A\u0441\u0435\u0441\u0441\u0443\u0430\u0440\u044B \u0434\u0440\u0443\u0433\u043E\u0433\u043E \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F \u043F\u0440\u0438 \u0438\u043C\u043F\u043E\u0440\u0442\u0435 \u0434\u043B\u044F \u043F\u0440\u043E\u0434\u0443\u043A\u0442\u0430 ".concat(product.id));
                            continue; // Пропускаем этот продукт
                        }
                    }
                    for (var _18 = 0, _19 = product.accessories; _18 < _19.length; _18++) {
                        var accessory = _19[_18];
                        insertAccessory.run({
                            product_id: product.id,
                            accessory_id: accessory.accessoryId,
                        });
                    }
                }
            }
            // Reservations
            if ((_r = snapshot.reservations) === null || _r === void 0 ? void 0 : _r.length) {
                var insertReservation = _this.db.prepare("INSERT OR REPLACE INTO reservations (id, user_id, product_id, quantity, customer, contact, status, due_at, comment, link_code, created_at, updated_at)\n           VALUES (@id, @user_id, @product_id, @quantity, @customer, @contact, @status, @due_at, @comment, @link_code, @created_at, @updated_at)");
                for (var _20 = 0, _21 = snapshot.reservations; _20 < _21.length; _20++) {
                    var res = _21[_20];
                    insertReservation.run({
                        id: res.id,
                        user_id: ownerId,
                        product_id: res.productId,
                        quantity: res.quantity,
                        customer: (_s = res.customer) !== null && _s !== void 0 ? _s : null,
                        contact: (_t = res.contact) !== null && _t !== void 0 ? _t : null,
                        status: res.status,
                        due_at: (_u = res.dueAt) !== null && _u !== void 0 ? _u : null,
                        comment: (_v = res.comment) !== null && _v !== void 0 ? _v : null,
                        link_code: res.linkCode,
                        created_at: (_w = res.createdAt) !== null && _w !== void 0 ? _w : new Date().toISOString(),
                        updated_at: (_x = res.updatedAt) !== null && _x !== void 0 ? _x : new Date().toISOString(),
                    });
                }
            }
            // Operations
            if ((_y = snapshot.operations) === null || _y === void 0 ? void 0 : _y.length) {
                var insertOperation = _this.db.prepare("INSERT OR REPLACE INTO operations\n          (id, user_id, product_id, type, quantity, customer, contact, permit_number, paid, reservation_id, bundle_id, due_at, comment, occurred_at, created_at)\n          VALUES\n          (@id, @user_id, @product_id, @type, @quantity, @customer, @contact, @permit_number, @paid, @reservation_id, @bundle_id, @due_at, @comment, @occurred_at, @created_at)");
                for (var _22 = 0, _23 = snapshot.operations; _22 < _23.length; _22++) {
                    var op = _23[_22];
                    insertOperation.run({
                        id: op.id,
                        user_id: ownerId,
                        product_id: op.productId,
                        type: op.type,
                        quantity: op.quantity,
                        customer: (_z = op.customer) !== null && _z !== void 0 ? _z : null,
                        contact: (_0 = op.contact) !== null && _0 !== void 0 ? _0 : null,
                        permit_number: (_1 = op.permitNumber) !== null && _1 !== void 0 ? _1 : null,
                        paid: op.paid ? 1 : 0,
                        reservation_id: (_2 = op.reservationId) !== null && _2 !== void 0 ? _2 : null,
                        bundle_id: (_3 = op.bundleId) !== null && _3 !== void 0 ? _3 : null,
                        due_at: (_4 = op.dueAt) !== null && _4 !== void 0 ? _4 : null,
                        comment: (_5 = op.comment) !== null && _5 !== void 0 ? _5 : null,
                        occurred_at: op.occurredAt,
                        created_at: (_7 = (_6 = op.createdAt) !== null && _6 !== void 0 ? _6 : op.occurredAt) !== null && _7 !== void 0 ? _7 : new Date().toISOString(),
                    });
                }
            }
            // Reminders
            if ((_8 = snapshot.reminders) === null || _8 === void 0 ? void 0 : _8.length) {
                var insertReminder = _this.db.prepare("INSERT OR REPLACE INTO reminders (id, user_id, title, message, due_at, done, target_type, target_id, created_at)\n           VALUES (@id, @user_id, @title, @message, @due_at, @done, @target_type, @target_id, @created_at)");
                for (var _24 = 0, _25 = snapshot.reminders; _24 < _25.length; _24++) {
                    var reminder = _25[_24];
                    insertReminder.run({
                        id: reminder.id,
                        user_id: ownerId,
                        title: reminder.title,
                        message: (_9 = reminder.message) !== null && _9 !== void 0 ? _9 : null,
                        due_at: reminder.dueAt,
                        done: reminder.done ? 1 : 0,
                        target_type: (_10 = reminder.targetType) !== null && _10 !== void 0 ? _10 : null,
                        target_id: (_11 = reminder.targetId) !== null && _11 !== void 0 ? _11 : null,
                        created_at: (_12 = reminder.createdAt) !== null && _12 !== void 0 ? _12 : new Date().toISOString(),
                    });
                }
            }
        });
        tx();
    };
    InventoryDatabase.prototype.mapUser = function (row) {
        var _a, _b;
        return {
            id: row.id,
            username: row.username,
            role: (_a = row.role) !== null && _a !== void 0 ? _a : 'user',
            email: (_b = row.email) !== null && _b !== void 0 ? _b : null,
            googleDriveFolderId: row.google_drive_folder_id,
            googleDriveClientId: row.google_drive_client_id,
            googleDriveClientSecret: row.google_drive_client_secret,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    };
    InventoryDatabase.prototype.listBundles = function (userId) {
        var _a;
        var ownerId = this.resolveUserId(userId);
        var rows = (_a = this.db
            .prepare('SELECT * FROM bundles WHERE user_id = ? ORDER BY id DESC')
            .all(ownerId)) !== null && _a !== void 0 ? _a : [];
        return rows.map(function (row) { return ({
            id: row.id,
            title: row.title,
            customer: row.customer,
            note: row.note,
            createdAt: row.created_at,
        }); });
    };
    return InventoryDatabase;
}());
export { InventoryDatabase };
