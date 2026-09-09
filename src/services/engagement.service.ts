// ============================================================
// EngagementService — small user-facing read domains grouped to
// keep the services layer organized without file sprawl:
// notifications, referrals, reports and public misc (captcha /
// site settings).
// ============================================================

import type { Bindings } from '../types/bindings'
import { generateCaptcha } from '../lib/captcha'
import { getJwtSecret } from '../lib/jwt'

export const NotificationService = {
  async list(env: Bindings, userId: number) {
    const db = env.DB
    const { results } = await db
      .prepare(`SELECT id, title, message, type, link, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`)
      .bind(userId)
      .all()

    const unread = await db
      .prepare('SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = 0')
      .bind(userId)
      .first<any>()

    return { notifications: results, unread_count: unread?.cnt || 0 }
  },

  async markRead(env: Bindings, userId: number, notificationId: string) {
    await env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
      .bind(notificationId, userId)
      .run()
  },

  async markAllRead(env: Bindings, userId: number) {
    await env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').bind(userId).run()
  },
}

export const ReferralService = {
  async getSummary(env: Bindings, userId: number) {
    const db = env.DB

    const me = await db.prepare('SELECT referral_code FROM users WHERE id = ?').bind(userId).first<any>()

    const { results: referredUsers } = await db
      .prepare(
        `SELECT u.name, u.created_at, r.bonus_amount, r.status
         FROM referrals r JOIN users u ON u.id = r.referred_id
         WHERE r.referrer_id = ? ORDER BY r.created_at DESC`
      )
      .bind(userId)
      .all()

    const totalEarned = await db
      .prepare(`SELECT COALESCE(SUM(bonus_amount),0) as total FROM referrals WHERE referrer_id = ? AND status = 'credited'`)
      .bind(userId)
      .first<any>()

    return {
      referral_code: me?.referral_code,
      total_referred: referredUsers.length,
      total_earned: totalEarned?.total || 0,
      referred_users: referredUsers,
    }
  },
}

export const ReportService = {
  async getOverview(env: Bindings, userId: number) {
    const db = env.DB

    const { results: dailySpending } = await db
      .prepare(
        `SELECT DATE(created_at) as day, SUM(-amount) as total
         FROM transactions WHERE user_id = ? AND type = 'order_payment' AND created_at >= DATE('now', '-14 days')
         GROUP BY DATE(created_at) ORDER BY day ASC`
      )
      .bind(userId)
      .all()

    const { results: serviceDistribution } = await db
      .prepare(
        `SELECT s.name_bn as service_name, COUNT(*) as count, SUM(o.price) as total_spent
         FROM orders o JOIN services s ON s.id = o.service_id
         WHERE o.user_id = ? GROUP BY o.service_id ORDER BY count DESC LIMIT 8`
      )
      .bind(userId)
      .all()

    const { results: statusBreakdown } = await db
      .prepare(`SELECT status, COUNT(*) as count FROM orders WHERE user_id = ? GROUP BY status`)
      .bind(userId)
      .all()

    return { daily_spending: dailySpending, service_distribution: serviceDistribution, status_breakdown: statusBreakdown }
  },
}

export const MiscService = {
  async getCaptcha(env: Bindings) {
    return generateCaptcha(getJwtSecret(env))
  },

  async getPublicSettings(env: Bindings) {
    const { results } = await env.DB.prepare('SELECT key, value FROM settings').all()
    const settings: Record<string, string> = {}
    for (const row of results as any[]) settings[row.key] = row.value
    return { settings }
  },
}
