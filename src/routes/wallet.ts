// ============================================================
// Wallet routes — thin adapters over WalletService.
// ============================================================

import { Hono } from 'hono'
import type { AppEnv } from '../types/bindings'
import { authRequired } from '../middleware/auth'
import { sanitizeText } from '../utils/validate'
import { WalletService } from '../services'

const wallet = new Hono<AppEnv>()

// GET /api/wallet/summary
wallet.get('/summary', authRequired, async (c) => {
  const result = await WalletService.getSummary(c.env, c.get('user')!.id)
  return c.json({ success: true, ...result })
})

// GET /api/wallet/transactions — paginated ledger
wallet.get('/transactions', authRequired, async (c) => {
  const result = await WalletService.listTransactions(c.env, c.get('user')!.id, parseInt(c.req.query('page') || '1', 10))
  return c.json({ success: true, ...result })
})

// GET /api/wallet/payment-methods — active manual methods for recharge screen
wallet.get('/payment-methods', authRequired, async (c) => {
  const result = await WalletService.getPaymentMethods(c.env)
  return c.json({ success: true, ...result })
})

// POST /api/wallet/recharge-request — manual recharge (with proof upload)
wallet.post('/recharge-request', authRequired, async (c) => {
  const user = c.get('user')!
  const fd = await c.req.formData().catch(() => null)
  if (!fd) return c.json({ success: false, message: 'ফর্ম ডেটা পড়া যায়নি।' }, 400)

  const result = await WalletService.createRechargeRequest(c.env, user.id, {
    method: sanitizeText(fd.get('method'), 20),
    senderNumber: sanitizeText(fd.get('sender_number'), 20),
    whatsappNumber: sanitizeText(fd.get('whatsapp_number'), 20),
    transactionId: sanitizeText(fd.get('transaction_id'), 50),
    amount: parseFloat(String(fd.get('amount') || '0')),
    proofFile: fd.get('proof_file') instanceof File ? (fd.get('proof_file') as File) : null,
  })

  return c.json({ success: true, message: result.message, request_no: result.requestNo })
})

// GET /api/wallet/recharge-requests — my recharge history
wallet.get('/recharge-requests', authRequired, async (c) => {
  const result = await WalletService.listMyRechargeRequests(c.env, c.get('user')!.id)
  return c.json({ success: true, ...result })
})

// POST /api/wallet/redeem-coupon
wallet.post('/redeem-coupon', authRequired, async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const result = await WalletService.redeemCoupon(c.env, c.get('user')!.id, body.code)
  return c.json({ success: true, message: result.message, bonus: result.bonus })
})

export default wallet
