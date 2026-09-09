// ============================================================
// ApiError — the single error type every service throws.
// Routes stay thin: they call services and let Hono's onError
// handler (wired in src/index.tsx) translate ApiError into the
// standard { success:false, message } JSON envelope.
// ============================================================

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly extra: Record<string, unknown> = {}
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const badRequest = (message: string, extra: Record<string, unknown> = {}) =>
  new ApiError(400, message, extra)
export const unauthorized = (message: string, extra: Record<string, unknown> = {}) =>
  new ApiError(401, message, extra)
export const forbidden = (message: string, extra: Record<string, unknown> = {}) =>
  new ApiError(403, message, extra)
export const notFound = (message: string, extra: Record<string, unknown> = {}) =>
  new ApiError(404, message, extra)
export const conflict = (message: string, extra: Record<string, unknown> = {}) =>
  new ApiError(409, message, extra)
