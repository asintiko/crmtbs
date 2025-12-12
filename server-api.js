// REST API сервер для веб-версии CRM
import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { InventoryDatabase } from './server-build/electron/database.js'
import crypto from 'node:crypto'
import fs from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000
const DB_PATH = process.env.DB_PATH || join(process.env.HOME || '/root', '.config', 'inventory-desktop', 'inventory.db')
const ADMIN_MAGIC_TOKEN = process.env.ADMIN_MAGIC_TOKEN || process.env.ADMIN_BYPASS_TOKEN || null

app.use(cors())
app.use(express.json())

// Инициализация базы данных
let db
try {
  db = new InventoryDatabase(DB_PATH)
  console.log('✅ База данных инициализирована:', DB_PATH)
} catch (error) {
  console.error('❌ Ошибка инициализации БД:', error)
  process.exit(1)
}

// Middleware для проверки сессии
const checkSession = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    return res.status(401).json({ error: 'Не авторизован' })
  }
  
  const session = db.getSessionByToken(token)
  if (!session || new Date(session.expiresAt) < new Date()) {
    return res.status(401).json({ error: 'Сессия истекла' })
  }
  
  req.userId = session.userId
  next()
}

// Auth endpoints
app.post('/api/auth/login', (req, res) => {
  try {
    const result = db.login(req.body)
    res.json({
      user: result.user,
      session: {
        token: result.session.token,
        expiresAt: result.session.expiresAt,
      },
    })
  } catch (error) {
    res.status(401).json({ error: error.message })
  }
})

// Magic link admin login (bypass login form with secret token)
app.post('/api/auth/magic', (req, res) => {
  try {
    if (!ADMIN_MAGIC_TOKEN) {
      return res.status(400).json({ error: 'Magic login не настроен' })
    }
    const token = req.body?.token
    if (!token || token !== ADMIN_MAGIC_TOKEN) {
      return res.status(401).json({ error: 'Неверный токен' })
    }

    // Берем первого админа или создаем
    let admin = db.listUsers().find((u) => u.role === 'admin')
    if (!admin) {
      admin = db.createUser({
        username: 'admin',
        password: crypto.randomBytes(8).toString('hex'),
        role: 'admin',
        email: null,
      })
    }
    const session = db.createSession(admin.id, 30)
    res.json({
      user: admin,
      session: {
        token: session.token,
        expiresAt: session.expiresAt,
      },
    })
  } catch (error) {
    res.status(401).json({ error: error.message })
  }
})

app.post('/api/auth/logout', checkSession, (req, res) => {
  db.deleteSession(req.headers.authorization?.replace('Bearer ', '') || '')
  res.json({ success: true })
})

app.get('/api/auth/me', checkSession, (req, res) => {
  const user = db.getUserById(req.userId)
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' })
  }
  res.json({ user })
})

// Products endpoints
app.get('/api/products', checkSession, (req, res) => {
  try {
    const products = db.listProducts(req.userId)
    res.json(products)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/products', checkSession, (req, res) => {
  try {
    const product = db.createProduct(req.body, req.userId)
    res.json(product)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.put('/api/products/:id', checkSession, (req, res) => {
  try {
    const product = db.updateProduct({ ...req.body, id: parseInt(req.params.id) }, req.userId)
    res.json(product)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.delete('/api/products/:id', checkSession, (req, res) => {
  try {
    db.deleteProduct(parseInt(req.params.id), req.userId)
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// Operations endpoints
app.get('/api/operations', checkSession, (req, res) => {
  try {
    const operations = db.listOperations(req.userId)
    res.json(operations)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/operations', checkSession, (req, res) => {
  try {
    const operation = db.createOperation(req.body, req.userId)
    res.json(operation)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.delete('/api/operations/:id', checkSession, (req, res) => {
  try {
    db.deleteOperation(parseInt(req.params.id), req.userId)
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// Dashboard endpoint
app.get('/api/dashboard', checkSession, (req, res) => {
  try {
    const dashboard = db.getDashboard(req.userId)
    res.json(dashboard)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Reservations endpoints
app.get('/api/reservations', checkSession, (req, res) => {
  try {
    const reservations = db.listReservations(req.userId)
    res.json(reservations)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.put('/api/reservations/:id', checkSession, (req, res) => {
  try {
    const reservation = db.updateReservation(
      { ...req.body, id: parseInt(req.params.id, 10) },
      req.userId,
    )
    res.json(reservation)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// Reminders endpoints
app.get('/api/reminders', checkSession, (req, res) => {
  try {
    const reminders = db.listReminders(req.userId)
    res.json(reminders)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/reminders', checkSession, (req, res) => {
  try {
    const reminder = db.createReminder(req.body, req.userId)
    res.json(reminder)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.put('/api/reminders/:id', checkSession, (req, res) => {
  try {
    const reminder = db.updateReminder({ ...req.body, id: parseInt(req.params.id) }, req.userId)
    res.json(reminder)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// Users endpoints (admin only)
app.get('/api/users', checkSession, (req, res) => {
  try {
    const user = db.getUserById(req.userId)
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ запрещен' })
    }
    const users = db.listUsers()
    res.json(users)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/users', checkSession, (req, res) => {
  try {
    const admin = db.getUserById(req.userId)
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ запрещен' })
    }
    const created = db.createUser(req.body)
    res.json(created)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.put('/api/users/:id', checkSession, (req, res) => {
  try {
    const admin = db.getUserById(req.userId)
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ запрещен' })
    }
    const updated = db.updateUser({ ...req.body, id: parseInt(req.params.id, 10) })
    res.json(updated)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.delete('/api/users/:id', checkSession, (req, res) => {
  try {
    const admin = db.getUserById(req.userId)
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ запрещен' })
    }
    db.deleteUser(parseInt(req.params.id, 10))
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// Sync endpoints
app.get('/api/sync/config', checkSession, (req, res) => {
  try {
    const config = db.getUserGoogleDriveConfig(req.userId)
    res.json(config)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/sync/config', checkSession, (req, res) => {
  try {
    db.updateUserGoogleDriveConfig(req.userId, req.body.clientId, req.body.clientSecret)
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// Full snapshot sync (server-side, без Google Drive)
app.get('/api/sync/full', checkSession, (req, res) => {
  try {
    const includeUsers = true
    const snapshot = db.exportSnapshot(includeUsers, req.userId)
    res.json(snapshot)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/sync/full', checkSession, (req, res) => {
  try {
    const user = db.getUserById(req.userId)
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ разрешён только администратору' })
    }
    const snapshot = req.body
    if (!snapshot || typeof snapshot !== 'object') {
      return res.status(400).json({ error: 'Некорректный snapshot' })
    }
    db.importSnapshot(snapshot, req.userId)
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// Redirect plain /login paths to hash-based login to avoid double /login#/login
// Express 5 uses different path syntax: {/*subpath} for wildcards
app.get('/login', (_req, res) => {
  res.redirect('/#/login')
})
app.get('/login{/*subpath}', (_req, res) => {
  res.redirect('/#/login')
})

// Статические файлы
app.use(express.static(join(__dirname, 'dist')))

// SPA fallback
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found' })
  }
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 CRM Server running on port ${PORT}`)
  console.log(`🌐 Open http://localhost:${PORT} in your browser`)
  console.log(`📊 Database: ${DB_PATH}`)
})
