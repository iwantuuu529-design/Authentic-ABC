// ============================================================
// Public webhook endpoints (no auth). Providers POST here.
// ============================================================

import { Hono } from 'hono'
import type { AppEnv } from '../types/bindings'
import { WalletService } from '../services/wallet.service'

const webhooks = new Hono<AppEnv>()

/**
 * UddoktaPay payment webhook. Best-effort only — the authoritative
 * confirmation happens when the buyer is redirected back to
 * /dashboard/wallet?pay=success&invoice_id=... (pull verify).
 * We never reject the webhook; we just try to finalize the request.
 */
webhooks.post('/uddoktapay', async (c) => {
  const body: any = await c.req.json().catch(() => ({}))
  const invoiceId = String(body?.invoice_id || body?.invoiceId || body?.id || '')
  if (invoiceId) {
    try {
      await WalletService.verifyAutoRecharge(c.env, null, invoiceId)
    } catch {
      // swallow — redirect-time verify is the source of truth
    }
  }
  return c.json({ success: true })
})

export default webhooks
