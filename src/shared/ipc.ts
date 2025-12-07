import type {
  AppPaths,
  BackupResult,
  DashboardSummary,
  NewProductPayload,
  OperationInput,
  OperationWithProduct,
  ProductSummary,
  UpdateProductPayload,
  Reservation,
  Reminder,
  UpdateInfo,
} from './types'

export interface InventoryAPI {
  listProducts: () => Promise<ProductSummary[]>
  createProduct: (payload: NewProductPayload) => Promise<ProductSummary>
  updateProduct: (payload: UpdateProductPayload) => Promise<ProductSummary>
  deleteProduct: (id: number) => Promise<void>
  listOperations: () => Promise<OperationWithProduct[]>
  createOperation: (payload: OperationInput) => Promise<OperationWithProduct>
  deleteOperation: (id: number) => Promise<void>
  getDashboard: () => Promise<DashboardSummary>
  listReservations: () => Promise<Reservation[]>
  updateReservation: (
    payload: Partial<Reservation> & { id: number; status?: Reservation['status'] },
  ) => Promise<Reservation>
  listReminders: () => Promise<Reminder[]>
  createReminder: (payload: Omit<Reminder, 'id' | 'done' | 'createdAt'>) => Promise<Reminder>
  updateReminder: (
    payload: Partial<Reminder> & { id: number; done?: boolean },
  ) => Promise<Reminder>
  backupNow: () => Promise<BackupResult>
  getPaths: () => Promise<AppPaths>
  checkForUpdates: () => Promise<UpdateInfo>
  openReleaseUrl: (url: string) => Promise<void>
}
