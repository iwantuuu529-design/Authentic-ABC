// ============================================================
// Admin user management routes — thin adapters over AdminUserService.
// ============================================================

import { Hono } from 'hono'
import type { AppEnv } from '../../types/bindings'
import { AdminUserService } from '../../services'

const adminUsers = new Hono<AppEnv>()

// GET /api/admin/users?q=&status=&page=
adminUsers.get('/', async (c) => {
  const result = await AdminUserService.listUsers(c.env, {
    q: c.req.query('q'),
    status: c.req.query('status'),
    page: parseInt(c.req.query('page') || '1', 10),
  })
  return c.json({ success: true, ...result })
})

// GET /api/admin/users/:id — full detail with orders/transactions
adminUsers.get('/:id', async (c) => {
  const result = await AdminUserService.getUserDetail(c.env, c.req.param('id'))
  return c.json({ success: true, ...result })
})

// PUT /api/admin/users/:id/status — approve (pending→active) / suspend / activate / ban
adminUsers.put('/:id/status', async (c) => {
  const admin = c.get('user')!
  const body = await c.req.json().catch(() => ({}))
  const result = await AdminUserService.setUserStatus(c.env, admin.id, c.req.param('id'), String(body.status || ''))
  return c.json({ success: true, message: result.message })
})

// POST /api/admin/users/:id/adjust-balance — manual credit/debit with reason
adminUsers.post('/:id/adjust-balance', async (c) => {
  const admin = c.get('user')!
  const body = await c.req.json().catch(() => ({}))
  const result = await AdminUserService.adjustBalance(c.env, admin.id, parseInt(c.req.param('id'), 10), body.amount, body.reason)
  return c.json({ success: true, message: result.message, balance_after: result.balance_after })
})

// PUT /api/admin/users/:id/kyc — approve/reject KYC
adminUsers.put('/:id/kyc', async (c) => {
  const admin = c.get('user')!
  const body = await c.req.json().catch(() => ({}))
  const result = await AdminUserService.setKycStatus(c.env, admin.id, c.req.param('id'), String(body.status || ''))
  return c.json({ success: true, message: result.message })
})

// DELETE /api/admin/users/:id — delete user account and associated records
adminUsers.delete('/:id', async (c) => {
  const admin = c.get('user')!
  try {
    const result = await AdminUserService.deleteUser(c.env, admin.id, c.req.param('id'))
    return c.json({ success: true, message: result.message })
  } catch (err: any) {
    if (err?.status) throw err
    console.error('Delete user error:', err)
    return c.json({ success: false, message: 'ইউজার ডিলিট করতে সমস্যা হয়েছে: ' + (err.message || 'ত্রুটি') }, 500)
  }
})

export default adminUsers
