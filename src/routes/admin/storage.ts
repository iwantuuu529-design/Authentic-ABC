// ============================================================
// Admin storage routes — thin adapters over AdminStorageService.
// ============================================================

import { Hono } from 'hono'
import type { AppEnv } from '../../types/bindings'
import { AdminStorageService } from '../../services'

const adminStorage = new Hono<AppEnv>()

// GET /api/admin/storage/usage — R2 document-storage overview
adminStorage.get('/usage', async (c) => {
  const result = await AdminStorageService.getUsage(c.env)
  return c.json({ success: true, ...result })
})

// DELETE /api/admin/storage/orphaned — purge unreferenced R2 objects
adminStorage.delete('/orphaned', async (c) => {
  const admin = c.get('user')!
  const result = await AdminStorageService.purgeOrphaned(c.env, admin.id)
  return c.json({ success: true, ...result })
})

export default adminStorage
