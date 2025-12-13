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
import { contextBridge, ipcRenderer } from 'electron';
var SESSION_TOKEN_KEY = 'session_token';
// Helper функция для получения токена
// В preload скрипте localStorage доступен через window.localStorage
// так как preload выполняется в контексте renderer процесса
function getToken() {
    try {
        // В Electron preload скрипт имеет доступ к window и localStorage
        if (typeof window !== 'undefined' && window.localStorage) {
            var token = window.localStorage.getItem(SESSION_TOKEN_KEY);
            return token;
        }
    }
    catch (error) {
        // Если localStorage недоступен, логируем и возвращаем null
        console.warn('Не удалось получить токен из localStorage в preload:', error);
    }
    return null;
}
var api = {
    // Auth
    login: function (payload) { return ipcRenderer.invoke('auth:login', payload); },
    logout: function () { return __awaiter(void 0, void 0, void 0, function () {
        var token;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    token = getToken();
                    return [4 /*yield*/, ipcRenderer.invoke('auth:logout', token)];
                case 1:
                    _a.sent();
                    try {
                        localStorage.removeItem(SESSION_TOKEN_KEY);
                    }
                    catch (_b) { }
                    return [2 /*return*/];
            }
        });
    }); },
    getCurrentUser: function () {
        var token = getToken();
        return ipcRenderer.invoke('auth:getCurrentUser', token);
    },
    checkSession: function (token) { return ipcRenderer.invoke('auth:checkSession', token); },
    refreshSession: function (token) { return ipcRenderer.invoke('auth:refreshSession', token); },
    // Users
    listUsers: function () {
        var token = getToken();
        return ipcRenderer.invoke('users:list', token);
    },
    createUser: function (payload) {
        var token = getToken();
        return ipcRenderer.invoke('users:create', payload, token);
    },
    updateUser: function (payload) {
        var token = getToken();
        return ipcRenderer.invoke('users:update', payload, token);
    },
    deleteUser: function (id) {
        var token = getToken();
        return ipcRenderer.invoke('users:delete', id, token);
    },
    listProducts: function () {
        var token = getToken();
        // #region agent log
        if (!token)
            console.warn('⚠️ No token available for listProducts');
        // #endregion
        return ipcRenderer.invoke('products:list', token);
    },
    createProduct: function (payload) {
        var token = getToken();
        return ipcRenderer.invoke('products:create', payload, token);
    },
    updateProduct: function (payload) {
        var token = getToken();
        return ipcRenderer.invoke('products:update', payload, token);
    },
    deleteProduct: function (id) {
        var token = getToken();
        return ipcRenderer.invoke('products:delete', id, token);
    },
    listOperations: function () {
        var token = getToken();
        return ipcRenderer.invoke('operations:list', token);
    },
    createOperation: function (payload) {
        var token = getToken();
        return ipcRenderer.invoke('operations:create', payload, token);
    },
    deleteOperation: function (id) {
        var token = getToken();
        return ipcRenderer.invoke('operations:delete', id, token);
    },
    getDashboard: function () {
        var token = getToken();
        return ipcRenderer.invoke('dashboard:get', token);
    },
    listReservations: function () {
        var token = getToken();
        return ipcRenderer.invoke('reservations:list', token);
    },
    updateReservation: function (payload) {
        var token = getToken();
        return ipcRenderer.invoke('reservations:update', payload, token);
    },
    listReminders: function () {
        var token = getToken();
        return ipcRenderer.invoke('reminders:list', token);
    },
    createReminder: function (payload) {
        var token = getToken();
        return ipcRenderer.invoke('reminders:create', payload, token);
    },
    updateReminder: function (payload) {
        var token = getToken();
        return ipcRenderer.invoke('reminders:update', payload, token);
    },
    backupNow: function () { return ipcRenderer.invoke('backup:manual'); },
    getPaths: function () { return ipcRenderer.invoke('meta:paths'); },
    checkForUpdates: function () { return ipcRenderer.invoke('updates:check'); },
    openReleaseUrl: function (url) { return ipcRenderer.invoke('updates:openUrl', url); },
    saveGoogleDriveConfig: function (clientId, clientSecret) {
        var token = getToken();
        return ipcRenderer.invoke('sync:saveGoogleDriveConfig', clientId, clientSecret, token);
    },
    getGoogleDriveConfig: function () {
        var token = getToken();
        return ipcRenderer.invoke('sync:getGoogleDriveConfig', token);
    },
    getGoogleDriveAuthUrl: function (redirectUri) {
        return ipcRenderer.invoke('sync:getGoogleDriveAuthUrl', redirectUri);
    },
    setGoogleDriveTokens: function (code, redirectUri) {
        return ipcRenderer.invoke('sync:setGoogleDriveTokens', code, redirectUri);
    },
    startSync: function () { return ipcRenderer.invoke('sync:start'); },
    syncPull: function () {
        var token = getToken();
        return ipcRenderer.invoke('sync:pull', token);
    },
    syncPush: function (snapshot) {
        var token = getToken();
        return ipcRenderer.invoke('sync:push', snapshot, token);
    },
};
// --------- Expose app API to the Renderer process ---------
contextBridge.exposeInMainWorld('api', api);
