import { Hono } from 'hono'
import type { AppEnv } from '../types/bindings'
import { authRequired } from '../middleware/auth'

const referral = new Hono<AppEnv>()

referral.get('/', authRequired, async (c) => {
  const user = c.get('user')!

  const me = await c.env.DB.prepare('SELECT referral_code FROM users WHERE id = ?').bind(user.id).first<any>()

  const { results: referredUsers } = await c.env.DB.prepare(
    `SELECT u.name, u.created_at, r.bonus_amount, r.status
     FROM referrals r JOIN users u ON u.id = r.referred_id
     WHERE r.referrer_id = ? ORDER BY r.created_at DESC`
  )
    .bind(user.id)
    .all()

  const totalEarned = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(bonus_amount),0) as total FROM referrals WHERE referrer_id = ? AND status = 'credited'`
  )
    .bind(user.id)
    .first<any>()

  return c.json({
    success: true,
    referral_code: me?.referral_code,
    total_referred: referredUsers.length,
    total_earned: totalEarned?.total || 0,
    referred_users: referredUsers,
  })
})

export default referral
