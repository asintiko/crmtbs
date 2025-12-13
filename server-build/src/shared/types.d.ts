export type OperationType = 'purchase' | 'sale' | 'reserve' | 'reserve_release' | 'sale_from_reserve' | 'ship_on_credit' | 'close_debt' | 'return';
export type UserRole = 'admin' | 'user';
export interface User {
    id: number;
    username: string;
    role: UserRole;
    email?: string | null;
    googleDriveFolderId?: string | null;
    googleDriveClientId?: string | null;
    googleDriveClientSecret?: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface Session {
    id: number;
    userId: number;
    token: string;
    expiresAt: string;
    createdAt: string;
}
export interface LoginPayload {
    username: string;
    password: string;
}
export interface CreateUserPayload {
    username: string;
    password: string;
    role?: UserRole;
    email?: string | null;
}
export interface UpdateUserPayload {
    id: number;
    username?: string;
    password?: string;
    role?: UserRole;
    email?: string | null;
    googleDriveFolderId?: string | null;
    googleDriveClientId?: string | null;
    googleDriveClientSecret?: string | null;
}
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';
export interface GoogleDriveConfig {
    enabled: boolean;
    folderId?: string | null;
    lastSyncAt?: string | null;
}
export interface Product {
    id: number;
    name: string;
    sku?: string | null;
    model?: string | null;
    minStock: number;
    hasImportPermit: boolean;
    notes?: string | null;
    archived: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface ProductAlias {
    id: number;
    productId: number;
    label: string;
}
export interface ProductTag extends ProductAlias {
}
export interface ProductAccessory {
    id: number;
    productId: number;
    accessoryId: number;
    accessoryName: string;
    accessorySku?: string | null;
}
export interface ProductWithAliases extends Product {
    aliases: ProductTag[];
    accessories?: ProductAccessory[];
}
export interface StockSnapshot {
    onHand: number;
    reserved: number;
    debt: number;
    balance: number;
    available: number;
}
export interface ProductSummary extends ProductWithAliases {
    stock: StockSnapshot;
}
export interface Operation {
    id: number;
    productId: number;
    type: OperationType;
    quantity: number;
    customer?: string | null;
    contact?: string | null;
    permitNumber?: string | null;
    paid?: boolean;
    reservationId?: number | null;
    bundleId?: number | null;
    dueAt?: string | null;
    comment?: string | null;
    occurredAt: string;
    createdAt: string;
}
export interface OperationWithProduct extends Operation {
    product: Pick<Product, 'id' | 'name' | 'sku'>;
    reservation?: Reservation | null;
    bundle?: OperationBundle | null;
}
export interface DashboardSummary {
    lowStock: ProductSummary[];
    activeDebts: Array<{
        customer: string;
        productId: number;
        productName: string;
        debt: number;
    }>;
    totalReserved: number;
}
export interface NewProductPayload {
    name: string;
    sku?: string | null;
    model?: string | null;
    minStock?: number;
    hasImportPermit?: boolean;
    notes?: string | null;
    aliases?: string[];
    accessoryIds?: number[];
}
export interface UpdateProductPayload extends Partial<NewProductPayload> {
    id: number;
    archived?: boolean;
}
export interface OperationInput {
    productId: number;
    type: OperationType;
    quantity: number;
    customer?: string | null;
    contact?: string | null;
    permitNumber?: string | null;
    paid?: boolean;
    reservationId?: number | null;
    bundleId?: number | null;
    bundleTitle?: string | null;
    dueAt?: string | null;
    comment?: string | null;
    occurredAt?: string;
}
export interface BackupResult {
    backupPath: string;
}
export interface AppPaths {
    database: string;
    backupsDir: string;
}
export interface Reservation {
    id: number;
    productId: number;
    quantity: number;
    customer?: string | null;
    contact?: string | null;
    status: 'active' | 'released' | 'sold' | 'expired';
    dueAt?: string | null;
    comment?: string | null;
    linkCode: string;
    createdAt: string;
    updatedAt: string;
    product: Pick<Product, 'id' | 'name' | 'sku'>;
}
export interface OperationBundle {
    id: number;
    title?: string | null;
    customer?: string | null;
    note?: string | null;
    createdAt: string;
}
export interface Reminder {
    id: number;
    title: string;
    message?: string | null;
    dueAt: string;
    done: boolean;
    targetType?: 'reservation' | 'operation' | null;
    targetId?: number | null;
    createdAt: string;
}
export interface UpdateInfo {
    hasUpdate: boolean;
    currentVersion: string;
    latestVersion?: string;
    releaseUrl?: string;
    releaseNotes?: string;
    downloadUrl?: string;
}
export interface SyncSnapshot {
    users?: User[];
    products: ProductSummary[];
    operations: OperationWithProduct[];
    reservations: Reservation[];
    reminders: Reminder[];
    bundles?: OperationBundle[];
}
