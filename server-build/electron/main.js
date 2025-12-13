var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _a;
import path from 'node:path';
import fs from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createBackup } from './backup';
import { InventoryDatabase } from './database';
// ESM полифилл для __dirname, __filename и require
var require = createRequire(import.meta.url);
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..');
process.on('unhandledRejection', function (reason) {
    console.error('Unhandled promise rejection in main process', reason);
});
process.on('uncaughtException', function (error) {
    console.error('Uncaught exception in main process', error);
});
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export var VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
export var MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export var RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST;
var isElectronRuntime = Boolean((_a = process.versions) === null || _a === void 0 ? void 0 : _a.electron);
// If running in plain Node (vite plugin runner), spawn Electron and exit current process.
if (!isElectronRuntime) {
    var electronEntry = require('electron');
    var electronPath = typeof electronEntry === 'string'
        ? electronEntry
        : typeof electronEntry.default === 'string'
            ? electronEntry.default
            : '';
    if (!electronPath) {
        throw new Error('Не удалось найти путь до Electron');
    }
    var child_1 = spawn(String(electronPath), [__filename], {
        stdio: 'inherit',
    });
    process.on('exit', function () { return child_1.kill(); });
    process.exit(0);
}
function bootstrap() {
    return __awaiter(this, void 0, void 0, function () {
        function createWindow() {
            win = new BrowserWindow({
                width: 1280,
                height: 800,
                minWidth: 1080,
                minHeight: 720,
                backgroundColor: '#0f172a',
                icon: path.join(process.env.VITE_PUBLIC, 'logo1.png'),
                webPreferences: {
                    preload: path.join(__dirname, 'preload.mjs'),
                },
                autoHideMenuBar: true,
            });
            Menu.setApplicationMenu(null);
            win.setMenuBarVisibility(false);
            win.removeMenu();
            if (VITE_DEV_SERVER_URL) {
                win.loadURL(VITE_DEV_SERVER_URL);
            }
            else {
                win.loadFile(path.join(RENDERER_DIST, 'index.html'));
            }
            win.on('close', function (event) {
                if (quitting)
                    return;
                event.preventDefault();
                win === null || win === void 0 ? void 0 : win.hide();
            });
        }
        function createTray() {
            var _a;
            var iconPath = path.join((_a = process.env.VITE_PUBLIC) !== null && _a !== void 0 ? _a : __dirname, 'logo1.png');
            var icon = null;
            try {
                if (fs.existsSync(iconPath)) {
                    var candidate = nativeImage.createFromPath(iconPath);
                    if (!candidate.isEmpty()) {
                        icon = candidate;
                    }
                }
            }
            catch (error) {
                console.warn('Tray icon load failed, fallback to default', error);
            }
            try {
                tray = icon ? new Tray(icon) : new Tray(nativeImage.createEmpty());
            }
            catch (error) {
                console.warn('Tray creation skipped', error);
                tray = null;
                return;
            }
            tray.setToolTip('Inventory Desktop');
            tray.on('click', function () {
                if (win) {
                    win.show();
                    win.focus();
                }
                else {
                    createWindow();
                }
            });
        }
        function startReminderLoop() {
            if (reminderInterval)
                clearInterval(reminderInterval);
            reminderInterval = setInterval(checkReminders, 60 * 1000);
            checkReminders();
        }
        function checkForUpdates() {
            return __awaiter(this, void 0, void 0, function () {
                var currentVersion, GITHUB_REPO, GITHUB_API_URL;
                return __generator(this, function (_a) {
                    currentVersion = app.getVersion();
                    GITHUB_REPO = 'asintiko/crmtbs';
                    GITHUB_API_URL = "https://api.github.com/repos/".concat(GITHUB_REPO, "/releases/latest");
                    return [2 /*return*/, new Promise(function (resolve) {
                            https
                                .get(GITHUB_API_URL, {
                                headers: {
                                    'User-Agent': 'Inventory-Desktop',
                                    Accept: 'application/vnd.github.v3+json',
                                },
                            }, function (res) {
                                var data = '';
                                res.on('data', function (chunk) {
                                    data += chunk;
                                });
                                res.on('end', function () {
                                    var _a, _b;
                                    try {
                                        if (res.statusCode !== 200) {
                                            resolve({
                                                hasUpdate: false,
                                                currentVersion: currentVersion,
                                            });
                                            return;
                                        }
                                        var release = JSON.parse(data);
                                        var latestVersion = ((_a = release.tag_name) === null || _a === void 0 ? void 0 : _a.replace(/^v/, '')) || release.tag_name;
                                        if (!latestVersion) {
                                            resolve({
                                                hasUpdate: false,
                                                currentVersion: currentVersion,
                                            });
                                            return;
                                        }
                                        // Простое сравнение версий (можно улучшить с помощью semver)
                                        var hasUpdate = latestVersion !== currentVersion;
                                        // Найти URL для скачивания Windows установщика
                                        var downloadUrl = void 0;
                                        var asset = (_b = release.assets) === null || _b === void 0 ? void 0 : _b.find(function (a) {
                                            return a.name.includes('Windows') && (a.name.endsWith('.exe') || a.name.endsWith('.Setup.exe') || a.name.includes('portable'));
                                        });
                                        if (asset) {
                                            downloadUrl = asset.browser_download_url;
                                        }
                                        resolve({
                                            hasUpdate: hasUpdate,
                                            currentVersion: currentVersion,
                                            latestVersion: latestVersion,
                                            releaseUrl: release.html_url,
                                            releaseNotes: release.body || undefined,
                                            downloadUrl: downloadUrl,
                                        });
                                    }
                                    catch (error) {
                                        console.error('Ошибка при парсинге ответа GitHub API:', error);
                                        resolve({
                                            hasUpdate: false,
                                            currentVersion: currentVersion,
                                        });
                                    }
                                });
                            })
                                .on('error', function (error) {
                                console.error('Ошибка при проверке обновлений:', error);
                                resolve({
                                    hasUpdate: false,
                                    currentVersion: currentVersion,
                                });
                            });
                        })];
                });
            });
        }
        // Helper функция для логирования (использует Node.js http)
        function logDebug(location, message, data, hypothesisId) {
            if (hypothesisId === void 0) { hypothesisId = 'A'; }
            try {
                var logData = JSON.stringify({
                    location: location,
                    message: message,
                    data: data,
                    timestamp: Date.now(),
                    sessionId: 'debug-session',
                    runId: 'multi-user',
                    hypothesisId: hypothesisId,
                });
                var url = new URL('http://127.0.0.1:7242/ingest/d0d7972b-8c29-47b4-9fc7-6bb593f6abb2');
                var options = {
                    hostname: url.hostname,
                    port: url.port,
                    path: url.pathname,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(logData),
                    },
                };
                var req = http.request(options, function () { });
                req.on('error', function () { }); // Игнорируем ошибки логирования
                req.write(logData);
                req.end();
            }
            catch (error) {
                // Игнорируем ошибки логирования
            }
        }
        // Helper функция для получения userId из токена сессии
        function getUserIdFromToken(token) {
            if (!db || !token) {
                // #region agent log
                logDebug('electron/main.ts:getUserIdFromToken', 'Token is null or db is null', { hasToken: !!token, hasDb: !!db }, 'A');
                // #endregion
                return null;
            }
            try {
                var session = db.getSessionByToken(token);
                if (session && new Date(session.expiresAt) > new Date()) {
                    // #region agent log
                    logDebug('electron/main.ts:getUserIdFromToken', 'User ID resolved from token', { token: token.substring(0, 8) + '...', userId: session.userId }, 'A');
                    // #endregion
                    return session.userId;
                }
                else {
                    // #region agent log
                    logDebug('electron/main.ts:getUserIdFromToken', 'Session invalid or expired', { hasSession: !!session, expired: session ? new Date(session.expiresAt) < new Date() : false }, 'A');
                    // #endregion
                }
            }
            catch (error) {
                console.error('Ошибка при получении userId из токена:', error);
                // #region agent log
                logDebug('electron/main.ts:getUserIdFromToken', 'Error getting userId', { error: error instanceof Error ? error.message : String(error) }, 'A');
                // #endregion
            }
            return null;
        }
        function registerIpc() {
            var _this = this;
            if (!db)
                return;
            // Auth
            ipcMain.handle('auth:login', function (_event, payload) {
                try {
                    // Получаем IP и User-Agent из события (если доступны)
                    var ipAddress = _event.sender.getURL() || undefined;
                    var userAgent = _event.sender.getUserAgent() || undefined;
                    var result = db === null || db === void 0 ? void 0 : db.login(payload, ipAddress, userAgent);
                    // #region agent log
                    if (result)
                        logDebug('electron/main.ts:auth:login', 'User logged in', { userId: result.user.id, username: result.user.username }, 'A');
                    // #endregion
                    return result;
                }
                catch (error) {
                    // #region agent log
                    logDebug('electron/main.ts:auth:login', 'Login failed', { error: error instanceof Error ? error.message : String(error) }, 'A');
                    // #endregion
                    throw error;
                }
            });
            ipcMain.handle('auth:logout', function (_event, token) {
                if (token && db) {
                    var session = db.getSessionByToken(token);
                    if (session) {
                        // Логируем выход
                        db.logAuditEvent(session.userId, 'logout', 'user', session.userId, null);
                    }
                    db.deleteSession(token);
                    // #region agent log
                    logDebug('electron/main.ts:auth:logout', 'User logged out', { token: token.substring(0, 8) + '...' }, 'A');
                    // #endregion
                }
            });
            ipcMain.handle('auth:getCurrentUser', function (_event, token) {
                var userId = getUserIdFromToken(token);
                if (userId) {
                    var user = db === null || db === void 0 ? void 0 : db.getUserById(userId);
                    // #region agent log
                    if (user)
                        logDebug('electron/main.ts:auth:getCurrentUser', 'Current user retrieved', { userId: user.id, username: user.username }, 'A');
                    // #endregion
                    return user !== null && user !== void 0 ? user : null;
                }
                // #region agent log
                logDebug('electron/main.ts:auth:getCurrentUser', 'No user found', { hasToken: !!token }, 'A');
                // #endregion
                return null;
            });
            // Обновление токена сессии
            ipcMain.handle('auth:refreshSession', function (_event, token) {
                if (!db || !token)
                    return null;
                try {
                    var refreshed = db.refreshSession(token, 30);
                    // #region agent log
                    if (refreshed)
                        logDebug('electron/main.ts:auth:refreshSession', 'Session refreshed', { userId: refreshed.userId }, 'A');
                    // #endregion
                    return refreshed;
                }
                catch (error) {
                    console.error('Ошибка при обновлении сессии:', error);
                    return null;
                }
            });
            ipcMain.handle('auth:checkSession', function (_event, token) {
                var userId = getUserIdFromToken(token);
                if (userId) {
                    var user = db === null || db === void 0 ? void 0 : db.getUserById(userId);
                    // #region agent log
                    if (user)
                        logDebug('electron/main.ts:auth:checkSession', 'Session checked', { userId: user.id, username: user.username }, 'A');
                    // #endregion
                    return user !== null && user !== void 0 ? user : null;
                }
                // #region agent log
                logDebug('electron/main.ts:auth:checkSession', 'Session invalid', { hasToken: !!token }, 'A');
                // #endregion
                return null;
            });
            // Users (admin only - проверяем права)
            ipcMain.handle('users:list', function (_event, token) {
                var userId = getUserIdFromToken(token);
                if (!userId)
                    throw new Error('Не авторизован');
                var user = db === null || db === void 0 ? void 0 : db.getUserById(userId);
                if (!user || user.role !== 'admin')
                    throw new Error('Доступ запрещен');
                return db === null || db === void 0 ? void 0 : db.listUsers();
            });
            ipcMain.handle('users:create', function (_event, payload, token) {
                var userId = getUserIdFromToken(token);
                if (!userId)
                    throw new Error('Не авторизован');
                var user = db === null || db === void 0 ? void 0 : db.getUserById(userId);
                if (!user || user.role !== 'admin')
                    throw new Error('Доступ запрещен');
                return db === null || db === void 0 ? void 0 : db.createUser(payload);
            });
            ipcMain.handle('users:update', function (_event, payload, token) {
                var userId = getUserIdFromToken(token);
                if (!userId)
                    throw new Error('Не авторизован');
                var user = db === null || db === void 0 ? void 0 : db.getUserById(userId);
                if (!user || user.role !== 'admin')
                    throw new Error('Доступ запрещен');
                return db === null || db === void 0 ? void 0 : db.updateUser(payload);
            });
            ipcMain.handle('users:delete', function (_event, id, token) {
                var userId = getUserIdFromToken(token);
                if (!userId)
                    throw new Error('Не авторизован');
                var user = db === null || db === void 0 ? void 0 : db.getUserById(userId);
                if (!user || user.role !== 'admin')
                    throw new Error('Доступ запрещен');
                db === null || db === void 0 ? void 0 : db.deleteUser(id);
            });
            // Products - с проверкой userId
            ipcMain.handle('products:list', function (_event, token) {
                var userId = getUserIdFromToken(token);
                if (!userId) {
                    // #region agent log
                    logDebug('electron/main.ts:products:list', 'Unauthorized access attempt', { hasToken: !!token, tokenLength: token === null || token === void 0 ? void 0 : token.length }, 'B');
                    // #endregion
                    throw new Error('Не авторизован');
                }
                // #region agent log
                logDebug('electron/main.ts:products:list', 'Listing products for user', { userId: userId }, 'B');
                // #endregion
                return db === null || db === void 0 ? void 0 : db.listProducts(userId);
            });
            ipcMain.handle('products:create', function (_event, payload, token) {
                var userId = getUserIdFromToken(token);
                if (!userId)
                    throw new Error('Не авторизован');
                // #region agent log
                logDebug('electron/main.ts:products:create', 'Creating product for user', { userId: userId, productName: payload.name }, 'B');
                // #endregion
                return db === null || db === void 0 ? void 0 : db.createProduct(payload, userId);
            });
            ipcMain.handle('products:update', function (_event, payload, token) {
                var userId = getUserIdFromToken(token);
                if (!userId)
                    throw new Error('Не авторизован');
                // #region agent log
                logDebug('electron/main.ts:products:update', 'Updating product for user', { userId: userId, productId: payload.id }, 'B');
                // #endregion
                return db === null || db === void 0 ? void 0 : db.updateProduct(payload, userId);
            });
            ipcMain.handle('products:delete', function (_event, id, token) {
                var userId = getUserIdFromToken(token);
                if (!userId)
                    throw new Error('Не авторизован');
                // #region agent log
                logDebug('electron/main.ts:products:delete', 'Deleting product for user', { userId: userId, productId: id }, 'B');
                // #endregion
                db === null || db === void 0 ? void 0 : db.deleteProduct(id, userId);
            });
            // Operations - с проверкой userId
            ipcMain.handle('operations:list', function (_event, token) {
                var userId = getUserIdFromToken(token);
                if (!userId) {
                    logDebug('electron/main.ts:operations:list', 'Unauthorized access attempt', { hasToken: !!token }, 'B');
                    throw new Error('Не авторизован');
                }
                return db === null || db === void 0 ? void 0 : db.listOperations(userId);
            });
            ipcMain.handle('operations:create', function (_event, payload, token) {
                var userId = getUserIdFromToken(token);
                if (!userId) {
                    logDebug('electron/main.ts:operations:create', 'Unauthorized access attempt', { hasToken: !!token }, 'B');
                    throw new Error('Не авторизован');
                }
                // #region agent log
                logDebug('electron/main.ts:operations:create', 'Creating operation for user', { userId: userId, operationType: payload.type, productId: payload.productId }, 'B');
                // #endregion
                return db === null || db === void 0 ? void 0 : db.createOperation(payload, userId);
            });
            ipcMain.handle('operations:delete', function (_event, id, token) {
                var userId = getUserIdFromToken(token);
                if (!userId) {
                    logDebug('electron/main.ts:operations:delete', 'Unauthorized access attempt', { hasToken: !!token }, 'B');
                    throw new Error('Не авторизован');
                }
                db === null || db === void 0 ? void 0 : db.deleteOperation(id, userId);
            });
            // Dashboard - с проверкой userId
            ipcMain.handle('dashboard:get', function (_event, token) {
                var userId = getUserIdFromToken(token);
                if (!userId)
                    throw new Error('Не авторизован');
                return db === null || db === void 0 ? void 0 : db.getDashboard(userId);
            });
            // Reservations - с проверкой userId
            ipcMain.handle('reservations:list', function (_event, token) {
                var userId = getUserIdFromToken(token);
                if (!userId)
                    throw new Error('Не авторизован');
                return db === null || db === void 0 ? void 0 : db.listReservations(userId);
            });
            ipcMain.handle('reservations:update', function (_event, payload, token) {
                var userId = getUserIdFromToken(token);
                if (!userId)
                    throw new Error('Не авторизован');
                return db === null || db === void 0 ? void 0 : db.updateReservation(payload, userId);
            });
            // Reminders - с проверкой userId
            ipcMain.handle('reminders:list', function (_event, token) {
                var userId = getUserIdFromToken(token);
                if (!userId)
                    throw new Error('Не авторизован');
                return db === null || db === void 0 ? void 0 : db.listReminders(userId);
            });
            ipcMain.handle('reminders:create', function (_event, payload, token) {
                var userId = getUserIdFromToken(token);
                if (!userId)
                    throw new Error('Не авторизован');
                return db === null || db === void 0 ? void 0 : db.createReminder(payload, userId);
            });
            ipcMain.handle('reminders:update', function (_event, payload, token) {
                var userId = getUserIdFromToken(token);
                if (!userId)
                    throw new Error('Не авторизован');
                return db === null || db === void 0 ? void 0 : db.updateReminder(payload, userId);
            });
            // Full snapshot sync (local) - с проверкой userId
            ipcMain.handle('sync:pull', function (_event, token) {
                var userId = getUserIdFromToken(token);
                if (!userId)
                    throw new Error('Не авторизован');
                return db === null || db === void 0 ? void 0 : db.exportSnapshot(true, userId);
            });
            ipcMain.handle('sync:push', function (_event, snapshot, token) {
                var userId = getUserIdFromToken(token);
                if (!userId)
                    throw new Error('Не авторизован');
                db === null || db === void 0 ? void 0 : db.importSnapshot(snapshot, userId);
                return { success: true };
            });
            ipcMain.handle('sync:getGoogleDriveConfig', function (_event, token) {
                var userId = getUserIdFromToken(token);
                if (!userId)
                    throw new Error('Не авторизован');
                return db === null || db === void 0 ? void 0 : db.getUserGoogleDriveConfig(userId);
            });
            ipcMain.handle('sync:saveGoogleDriveConfig', function (_event, clientId, clientSecret, token) {
                var userId = getUserIdFromToken(token);
                if (!userId)
                    throw new Error('Не авторизован');
                if (!db)
                    throw new Error('База данных не инициализирована');
                db.updateUserGoogleDriveConfig(userId, clientId, clientSecret);
                return { success: true };
            });
            ipcMain.handle('backup:manual', function () {
                if (!db)
                    throw new Error('База данных не инициализирована');
                var backupPath = createBackup(db.getPath(), getBackupDir());
                return { backupPath: backupPath };
            });
            ipcMain.handle('meta:paths', function () {
                if (!db)
                    throw new Error('База данных не инициализирована');
                return {
                    database: db.getPath(),
                    backupsDir: getBackupDir(),
                };
            });
            ipcMain.handle('updates:check', function () { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, checkForUpdates()];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            }); });
            ipcMain.handle('updates:openUrl', function (_event, url) { return __awaiter(_this, void 0, void 0, function () {
                var shell;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            shell = require('electron').shell;
                            return [4 /*yield*/, shell.openExternal(url)];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
        }
        var _a, app, BrowserWindow, ipcMain, Tray, Notification, nativeImage, Menu, getDbPath, getBackupDir, win, db, tray, reminderInterval, quitting, checkReminders;
        return __generator(this, function (_b) {
            _a = require('electron'), app = _a.app, BrowserWindow = _a.BrowserWindow, ipcMain = _a.ipcMain, Tray = _a.Tray, Notification = _a.Notification, nativeImage = _a.nativeImage, Menu = _a.Menu;
            getDbPath = function () { return path.join(app.getPath('userData'), 'inventory.db'); };
            getBackupDir = function () { return path.join(app.getPath('documents'), 'InventoryBackups'); };
            db = null;
            tray = null;
            reminderInterval = null;
            quitting = false;
            checkReminders = function () {
                var _a;
                if (!db)
                    return;
                // Проверяем напоминания для всех пользователей
                var users = db.listUsers();
                for (var _i = 0, users_1 = users; _i < users_1.length; _i++) {
                    var user = users_1[_i];
                    var reminders = db.listReminders(user.id).filter(function (r) { return !r.done; });
                    var now = Date.now();
                    for (var _b = 0, reminders_1 = reminders; _b < reminders_1.length; _b++) {
                        var reminder = reminders_1[_b];
                        if (new Date(reminder.dueAt).getTime() <= now) {
                            var notif = new Notification({
                                title: reminder.title,
                                body: (_a = reminder.message) !== null && _a !== void 0 ? _a : 'Напоминание',
                            });
                            notif.show();
                            db.updateReminder({ id: reminder.id, done: true }, user.id);
                            // #region agent log
                            logDebug('electron/main.ts:checkReminders', 'Reminder notification shown', { userId: user.id, reminderId: reminder.id }, 'C');
                            // #endregion
                        }
                    }
                }
            };
            app.on('window-all-closed', function () {
                if (process.platform !== 'darwin') {
                    app.quit();
                    win = null;
                }
            });
            app.on('before-quit', function () {
                quitting = true;
                if (db) {
                    try {
                        createBackup(db.getPath(), getBackupDir());
                    }
                    catch (error) {
                        console.error('Ошибка при создании резервной копии', error);
                    }
                }
            });
            app.on('activate', function () {
                if (BrowserWindow.getAllWindows().length === 0) {
                    createWindow();
                }
            });
            app.whenReady().then(function () {
                db = new InventoryDatabase(getDbPath());
                registerIpc();
                createTray();
                startReminderLoop();
                createWindow();
            });
            return [2 /*return*/];
        });
    });
}
bootstrap().catch(function (error) {
    console.error('Main bootstrap failed', error);
});
