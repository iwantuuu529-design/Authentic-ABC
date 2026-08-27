export async function pushNotification(
  db: D1Database,
  userId: number,
  title: string,
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info',
  link?: string
) {
  await db
    .prepare(
      `INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?)`
    )
    .bind(userId, title, message, type, link || null)
    .run()
}

export async function logOrderEvent(
  db: D1Database,
  orderId: number,
  actorType: 'system' | 'user' | 'admin',
  actorId: number | null,
  action: string,
  note?: string
) {
  await db
    .prepare(
      `INSERT INTO order_logs (order_id, actor_type, actor_id, action, note) VALUES (?, ?, ?, ?, ?)`
    )
    .bind(orderId, actorType, actorId, action, note || null)
    .run()
}

export async function logAdminAction(
  db: D1Database,
  adminId: number,
  action: string,
  targetType?: string,
  targetId?: number,
  note?: string,
  ip?: string
) {
  await db
    .prepare(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, note, ip_address) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(adminId, action, targetType || null, targetId || null, note || null, ip || null)
    .run()
}
