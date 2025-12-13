import type { AppPaths, BackupResult, DashboardSummary, NewProductPayload, OperationInput, OperationWithProduct, ProductSummary, UpdateProductPayload, Reservation, Reminder, UpdateInfo, User, LoginPayload, CreateUserPayload, UpdateUserPayload } from './types';
export interface InventoryAPI {
    login: (payload: LoginPayload) => Promise<{
        user: User;
        session: {
            token: string;
            expiresAt: string;
        };
    }>;
    magicLogin?: (token: string) => Promise<{
        user: User;
        session: {
            token: string;
            expiresAt: string;
        };
    }>;
    logout: () => Promise<void>;
    getCurrentUser: () => Promise<User | null>;
    checkSession: (token: string) => Promise<User | null>;
    refreshSession?: (token: string) => Promise<{
        token: string;
        expiresAt: string;
    } | null>;
    listUsers: () => Promise<User[]>;
    createUser: (payload: CreateUserPayload) => Promise<User>;
    updateUser: (payload: UpdateUserPayload) => Promise<User>;
    deleteUser: (id: number) => Promise<void>;
    listProducts: () => Promise<ProductSummary[]>;
    createProduct: (payload: NewProductPayload) => Promise<ProductSummary>;
    updateProduct: (payload: UpdateProductPayload) => Promise<ProductSummary>;
    deleteProduct: (id: number) => Promise<void>;
    listOperations: () => Promise<OperationWithProduct[]>;
    createOperation: (payload: OperationInput) => Promise<OperationWithProduct>;
    deleteOperation: (id: number) => Promise<void>;
    getDashboard: () => Promise<DashboardSummary>;
    listReservations: () => Promise<Reservation[]>;
    updateReservation: (payload: Partial<Reservation> & {
        id: number;
        status?: Reservation['status'];
    }) => Promise<Reservation>;
    listReminders: () => Promise<Reminder[]>;
    createReminder: (payload: Omit<Reminder, 'id' | 'done' | 'createdAt'>) => Promise<Reminder>;
    updateReminder: (payload: Partial<Reminder> & {
        id: number;
        done?: boolean;
    }) => Promise<Reminder>;
    backupNow: () => Promise<BackupResult>;
    getPaths: () => Promise<AppPaths>;
    checkForUpdates: () => Promise<UpdateInfo>;
    openReleaseUrl: (url: string) => Promise<void>;
    saveGoogleDriveConfig: (clientId: string, clientSecret: string) => Promise<{
        success: boolean;
    }>;
    getGoogleDriveConfig: () => Promise<{
        clientId: string | null;
        clientSecret: string | null;
        accessToken: string | null;
        refreshToken: string | null;
    } | null>;
    getGoogleDriveAuthUrl: (redirectUri?: string) => Promise<string>;
    setGoogleDriveTokens: (code: string, redirectUri?: string) => Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    startSync: () => Promise<{
        success: boolean;
        message: string;
    }>;
    syncPull?: () => Promise<import('./types').SyncSnapshot>;
    syncPush?: (snapshot: import('./types').SyncSnapshot) => Promise<{
        success: boolean;
    }>;
}
