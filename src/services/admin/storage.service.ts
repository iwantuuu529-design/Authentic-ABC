// ============================================================
// AdminStorageService — R2 storage observability + safe cleanup.
// Walks the bucket, categorizes every object, detects orphans
// (files no live DB row references anymore) and purges only
// those — users' visible documents are never at risk.
// ============================================================

import type { Bindings } from '../../types/bindings'
import { logAdminAction } from '../../lib/notify'

/**
 * Walks the whole R2 bucket (paginated) and returns every object's
 * key + size. Small reseller-site scale, so a full listing on demand
 * is fine — no need to cache/index it separately.
 */
async function listAllObjects(bucket: R2Bucket) {
  const objects: { key: string; size: number; uploaded: string }[] = []
  let cursor: string | undefined = undefined
  do {
    const page = await bucket.list({ cursor, limit: 1000 })
    for (const o of page.objects) {
      objects.push({ key: o.key, size: o.size, uploaded: o.uploaded ? new Date(o.uploaded).toISOString() : '' })
    }
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
  return objects
}

/**
 * Collects every R2 object key still referenced by a live DB row.
 * Covers all THREE upload paths in this app:
 *   1. orders/<user_id>/...          — user-submitted form file fields
 *   2. results/<user_id>/...         — admin-attached order result file
 *   3. recharge_proofs/<user_id>/... — manual recharge payment proof
 */
async function collectReferencedKeys(db: D1Database): Promise<Set<string>> {
  const referenced = new Set<string>()

  // 1) order.result_file_key (admin-attached result files)
  const resultKeys = await db.prepare(`SELECT result_file_key FROM orders WHERE result_file_key IS NOT NULL`).all<any>()
  for (const row of resultKeys.results as any[]) {
    if (row.result_file_key) referenced.add(row.result_file_key)
  }

  // 2) recharge_requests.proof_file_key
  const proofKeys = await db.prepare(`SELECT proof_file_key FROM recharge_requests WHERE proof_file_key IS NOT NULL`).all<any>()
  for (const row of proofKeys.results as any[]) {
    if (row.proof_file_key) referenced.add(row.proof_file_key)
  }

  // 3) order.form_data — user-uploaded file fields (NID scans, photos, etc.)
  //    Value format for a file field is the raw R2 object key string
  //    (see OrderService.createOrder): "orders/<user_id>/<ts>-<field>-<filename>"
  const formDataRows = await db.prepare(`SELECT form_data FROM orders WHERE form_data IS NOT NULL`).all<any>()
  for (const row of formDataRows.results as any[]) {
    let parsed: Record<string, any> = {}
    try {
      parsed = JSON.parse(row.form_data)
    } catch {
      continue
    }
    for (const v of Object.values(parsed)) {
      if (typeof v === 'string' && v.startsWith('orders/')) referenced.add(v)
    }
  }

  return referenced
}

export const AdminStorageService = {
  /** R2 usage overview: totals per category + orphaned (purge-safe) stats. */
  async getUsage(env: Bindings) {
    const objects = await listAllObjects(env.FILES)
    const referenced = await collectReferencedKeys(env.DB)

    const categories: Record<string, { label: string; count: number; size: number }> = {
      orders: { label: 'ইউজারের আপলোড করা অর্ডার ডকুমেন্ট', count: 0, size: 0 },
      results: { label: 'এডমিনের সংযুক্ত ফলাফল ফাইল', count: 0, size: 0 },
      recharge_proofs: { label: 'রিচার্জ পেমেন্ট প্রুফ', count: 0, size: 0 },
      other: { label: 'অন্যান্য', count: 0, size: 0 },
    }

    let orphanedCount = 0
    let orphanedSize = 0
    let totalCount = 0
    let totalSize = 0

    for (const obj of objects) {
      totalCount++
      totalSize += obj.size
      const prefix = obj.key.split('/')[0]
      const bucket = categories[prefix] ? prefix : 'other'
      categories[bucket].count++
      categories[bucket].size += obj.size

      if (!referenced.has(obj.key)) {
        orphanedCount++
        orphanedSize += obj.size
      }
    }

    return {
      total: { count: totalCount, size: totalSize },
      categories,
      orphaned: { count: orphanedCount, size: orphanedSize },
    }
  },

  /** Permanently deletes every orphaned R2 object (batched, ≤1000/call). */
  async purgeOrphaned(env: Bindings, adminId: number) {
    const objects = await listAllObjects(env.FILES)
    const referenced = await collectReferencedKeys(env.DB)

    const toDelete = objects.filter((o) => !referenced.has(o.key))
    const freedBytes = toDelete.reduce((sum, o) => sum + o.size, 0)

    // R2 delete() accepts up to 1000 keys per call — batch it defensively.
    for (let i = 0; i < toDelete.length; i += 1000) {
      const batch = toDelete.slice(i, i + 1000).map((o) => o.key)
      if (batch.length) await env.FILES.delete(batch)
    }

    await logAdminAction(env.DB, adminId, 'storage_orphaned_purged', 'storage', undefined, `${toDelete.length} files, ${freedBytes} bytes`)

    return {
      message: `${toDelete.length}টি অব্যবহৃত ফাইল মুছে ফেলা হয়েছে, ${(freedBytes / (1024 * 1024)).toFixed(2)} MB খালি হয়েছে।`,
      deleted_count: toDelete.length,
      freed_bytes: freedBytes,
    }
  },
}
