import type { DashboardSummary, NewProductPayload, OperationInput, OperationWithProduct, ProductSummary, Reservation, Reminder, LoginPayload, CreateUserPayload, UpdateUserPayload, Session, User, SyncSnapshot, UpdateProductPayload } from '../src/shared/types';
export declare class InventoryDatabase {
    private filePath;
    private db;
    constructor(filePath: string);
    getPath(): string;
    private migrate;
    private backfillDefaultUser;
    private resolveUserId;
    listProducts(userId?: number): ProductSummary[];
    createProduct(payload: NewProductPayload, userId?: number): ProductSummary;
    updateProduct(payload: UpdateProductPayload, userId?: number): ProductSummary;
    listOperations(userId?: number): OperationWithProduct[];
    createOperation(payload: OperationInput, userId?: number): OperationWithProduct;
    deleteOperation(id: number, userId?: number): void;
    deleteProduct(id: number, userId?: number): void;
    getDashboard(userId?: number): DashboardSummary;
    listReservations(userId?: number): Reservation[];
    updateReservation(payload: Partial<Reservation> & {
        id: number;
    }, userId?: number): Reservation;
    listReminders(userId?: number): Reminder[];
    createReminder(payload: Omit<Reminder, 'id' | 'done' | 'createdAt'>, userId?: number): Reminder;
    updateReminder(payload: Partial<Reminder> & {
        id: number;
        done?: boolean;
    }, userId?: number): Reminder;
    private loadAliases;
    private loadAccessories;
    private upsertAccessories;
    private mapProduct;
    private mapOperation;
    private getCustomerDebt;
    private getStockByProduct;
    login(payload: LoginPayload, ipAddress?: string, userAgent?: string): {
        user: User;
        session: Session;
    };
    createSession(userId: number, days?: number): Session;
    getSessionByToken(token: string): Session | null;
    deleteSession(token: string): void;
    refreshSession(token: string, days?: number): Session | null;
    logAuditEvent(userId: number, actionType: string, entityType: string, entityId?: number | null, details?: string | null, ipAddress?: string | null, userAgent?: string | null): void;
    getUserById(id: number): User | null;
    listUsers(): User[];
    createUser(payload: CreateUserPayload): User;
    updateUser(payload: UpdateUserPayload): User;
    deleteUser(id: number): void;
    getUserGoogleDriveConfig(userId: number): {
        clientId: string | null;
        clientSecret: string | null;
        folderId: string | null;
        accessToken: null;
        refreshToken: null;
    } | null;
    updateUserGoogleDriveConfig(userId: number, clientId: string | null, clientSecret: string | null, folderId?: string | null): void;
    exportSnapshot(includeUsers?: boolean, userId?: number): SyncSnapshot;
    importSnapshot(snapshot: SyncSnapshot, userId?: number): void;
    private mapUser;
    private listBundles;
}
