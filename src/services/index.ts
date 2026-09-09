// ============================================================
// Service layer barrel — single import point for route files.
// Every piece of business logic (SQL, validation, wallet rules,
// fulfillment, notifications) lives in these modules; routes are
// thin HTTP adapters.
// ============================================================

export { ApiError } from './errors'
export { AuthService } from './auth.service'
export { CatalogService } from './catalog.service'
export { OrderService } from './order.service'
export { AUTO_DOCUMENT_SLUGS, LOOKUP_SLUGS, HUMAN_SLUGS, buildAutoResult, serviceFamily, processingLabel } from './fulfillment.service'
export type { CreateOrderInput } from './order.service'
export { WalletService } from './wallet.service'
export { DashboardService } from './dashboard.service'
export { SupportService } from './support.service'
export { NotificationService, ReferralService, ReportService, MiscService } from './engagement.service'

export { AdminDashboardService } from './admin/dashboard.service'
export { AdminUserService } from './admin/user.service'
export { AdminOrderService } from './admin/order.service'
export { AdminRechargeService } from './admin/recharge.service'
export { AdminCatalogService } from './admin/catalog.service'
export { AdminProviderService } from './admin/provider.service'
export { AdminCouponService } from './admin/coupon.service'
export { AdminSettingsService } from './admin/settings.service'
export { AdminStorageService } from './admin/storage.service'
