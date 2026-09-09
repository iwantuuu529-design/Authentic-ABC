import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import type { D1Database, R2Bucket } from '../types/bindings'

function sanitizeParam(param: any): any {
  if (param === undefined) return null
  if (typeof param === 'boolean') return param ? 1 : 0
  return param
}

export function createLocalD1Database(dbFilePath?: string): D1Database {
  const rootDir = process.cwd()
  const dataDir = path.join(rootDir, 'data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  const dbPath = dbFilePath || path.join(dataDir, 'webapp.sqlite')
  const isNew = !fs.existsSync(dbPath)

  const db = new DatabaseSync(dbPath)

  if (isNew) {
    console.log('[D1 Adapter] Initializing new SQLite database from schema and seed...')
    const schemaPath = path.join(rootDir, 'migrations', '0001_initial_schema.sql')
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf-8')
      db.exec(schemaSql)
      console.log('[D1 Adapter] Initial schema applied.')
    }

    const seedPath = path.join(rootDir, 'seed.sql')
    if (fs.existsSync(seedPath)) {
      const seedSql = fs.readFileSync(seedPath, 'utf-8')
      db.exec(seedSql)
      console.log('[D1 Adapter] Seed data applied.')
    }
  } else {
    // Apply pending migrations (0002+) on every startup. They are idempotent
    // (deterministic UPDATEs / INSERT OR IGNORE), so re-running is safe and
    // keeps older local databases in sync with the latest per-service logic.
    try {
      const migrationsDir = path.join(rootDir, 'migrations')
      const migrationFiles = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql') && !f.startsWith('0001'))
        .sort()
      for (const file of migrationFiles) {
        db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf-8'))
      }
      if (migrationFiles.length) {
        console.log(`[D1 Adapter] Re-applied migrations: ${migrationFiles.join(', ')}`)
      }
    } catch (e) {
      console.error('[D1 Adapter] Error applying migrations:', e)
    }

    // Ensure the NID CREATE (nid-create) service is present even if DB was previously initialized
    try {
      db.prepare(`
        UPDATE services
        SET category_id = 2,
            name_bn = 'এনআইডি ক্রিয়েট',
            name_en = 'NID CREATE',
            slug = 'nid-create',
            description_bn = 'পিডিএফ আপলোড করে অটো-প্রসেসিংয়ের মাধ্যমে ইউনিক ফরম্যাটে এনআইডি কার্ড প্রস্তুত করুন।',
            icon = 'fa-id-card'
        WHERE slug = 'nibandan-pdf-create'
      `).run()

      const check = db.prepare("SELECT id FROM services WHERE slug = 'nid-create'").get()
      if (!check) {
        console.log('[D1 Adapter] Auto-inserting nid-create service...')
        db.prepare(`
          INSERT INTO services
          (category_id, name_bn, name_en, slug, description_bn, icon, price, cost_price, fulfillment_mode, form_schema, avg_delivery_minutes, requires_captcha, is_featured, sort_order, status)
          VALUES
          (2, 'এনআইডি ক্রিয়েট', 'NID CREATE', 'nid-create',
           'পিডিএফ আপলোড করে অটো-প্রসেসিংয়ের মাধ্যমে ইউনিক ফরম্যাটে এনআইডি কার্ড প্রস্তুত করুন।', 'fa-id-card', 4.00, 1.00, 'auto',
           '[{"name":"pdf_file","label_bn":"পিডিএফ আপলোড করুন","type":"file","accept":".pdf","required":true},{"name":"name_bn","label_bn":"নাম (বাংলা)","type":"text","required":true},{"name":"name_en","label_bn":"নাম (ইংরেজি)","type":"text","required":true},{"name":"registration_no","label_bn":"এনআইডি নম্বর","type":"text","required":true},{"name":"book_no","label_bn":"পিন নম্বর","type":"text","required":false},{"name":"father_name_bn","label_bn":"পিতার নাম","type":"text","required":true},{"name":"mother_name_bn","label_bn":"মাতার নাম","type":"text","required":true},{"name":"birth_place","label_bn":"জন্মস্থান","type":"text","required":true},{"name":"dob","label_bn":"জন্ম তারিখ","type":"text","required":true},{"name":"gender_blood","label_bn":"রক্তের গ্রুপ / লিঙ্গ","type":"text","required":false},{"name":"issue_date","label_bn":"প্রদানের তারিখ","type":"text","required":false},{"name":"address","label_bn":"ঠিকানা","type":"textarea","required":true}]',
           5, 0, 1, 1, 'active')
        `).run()
      }

      // Ensure configured admin user 01835414122 is synchronized in SQLite
      const adminHash = 'pbkdf2$100000$7c03cb6c27aef72ac2c8b8607ff85be5$3beab32737447cad4c4b05f20511a166cc464c559b762f60ec0e355a518a1c30'
      const existingAdmin = db.prepare("SELECT id FROM users WHERE phone = '01835414122'").get()
      if (existingAdmin) {
        db.prepare("UPDATE users SET password_hash = ?, role = 'admin', status = 'active', failed_login_attempts = 0, locked_until = NULL WHERE phone = '01835414122'").run(adminHash)
      } else {
        db.prepare(`
          INSERT INTO users (id, name, email, phone, password_hash, role, balance, referral_code, kyc_status, phone_verified, email_verified, status)
          VALUES (1, 'Super Admin', 'admin@docflow.bd', '01835414122', ?, 'admin', 10000, 'ADMIN001', 'verified', 1, 1, 'active')
          ON CONFLICT(id) DO UPDATE SET phone = '01835414122', password_hash = excluded.password_hash, role = 'admin', status = 'active'
        `).run(adminHash)
      }
    } catch (e) {
      console.error('[D1 Adapter] Error ensuring nid-create service or admin user:', e)
    }
  }

  function createPreparedStatement(sql: string, params: any[] = []): any {
    return {
      bind(...newParams: any[]) {
        return createPreparedStatement(sql, newParams)
      },
      async first<T = unknown>(colName?: string): Promise<T | null> {
        const sanitized = params.map(sanitizeParam)
        const stmt = db.prepare(sql)
        const row = stmt.get(...sanitized) as any
        if (!row) return null
        if (colName) {
          return (row[colName] !== undefined ? row[colName] : null) as T
        }
        return { ...row } as T
      },
      async all<T = unknown>(): Promise<{ results: T[]; success: boolean; meta: any }> {
        const sanitized = params.map(sanitizeParam)
        const stmt = db.prepare(sql)
        const rows = stmt.all(...sanitized) as any[]
        const results = rows.map((r) => ({ ...r })) as T[]
        return {
          results,
          success: true,
          meta: { duration: 0, changes: 0 },
        }
      },
      async run(): Promise<{ success: boolean; meta: { changes: number; last_row_id: number } }> {
        const sanitized = params.map(sanitizeParam)
        const stmt = db.prepare(sql)
        const info = stmt.run(...sanitized)
        return {
          success: true,
          meta: {
            changes: info.changes,
            last_row_id: Number(info.lastInsertRowid),
          },
        }
      },
      async raw<T = unknown>(): Promise<T[]> {
        const sanitized = params.map(sanitizeParam)
        const stmt = db.prepare(sql)
        const rows = stmt.all(...sanitized) as any[]
        return rows.map((r) => Object.values(r)) as T[]
      },
    }
  }

  const d1Instance: any = {
    prepare(sql: string) {
      return createPreparedStatement(sql)
    },
    async batch<T = unknown>(statements: any[]): Promise<any[]> {
      const results: any[] = []
      for (const stmt of statements) {
        results.push(await stmt.all())
      }
      return results
    },
    async exec(query: string): Promise<{ count: number; duration: number }> {
      db.exec(query)
      return { count: 0, duration: 0 }
    },
  }

  return d1Instance as D1Database
}

export function createLocalR2Bucket(storageDir?: string): R2Bucket {
  const rootDir = process.cwd()
  const uploadsDir = storageDir || path.join(rootDir, 'data', 'uploads')
  const metaDir = path.join(uploadsDir, '.meta')

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
  }
  if (!fs.existsSync(metaDir)) {
    fs.mkdirSync(metaDir, { recursive: true })
  }

  function getFilePath(key: string): string {
    const safeKey = key.replace(/^[/\\]+/, '').replace(/[\\/]+/g, '_')
    return path.join(uploadsDir, safeKey)
  }

  function getMetaPath(key: string): string {
    const safeKey = key.replace(/^[/\\]+/, '').replace(/[\\/]+/g, '_')
    return path.join(metaDir, `${safeKey}.json`)
  }

  const r2Instance: any = {
    async put(key: string, value: any, options?: { httpMetadata?: { contentType?: string } }) {
      const filePath = getFilePath(key)
      let buffer: Buffer

      if (Buffer.isBuffer(value)) {
        buffer = value
      } else if (value instanceof Uint8Array) {
        buffer = Buffer.from(value.buffer, value.byteOffset, value.byteLength)
      } else if (value instanceof ArrayBuffer) {
        buffer = Buffer.from(value)
      } else if (typeof value === 'string') {
        buffer = Buffer.from(value, 'utf-8')
      } else if (value && typeof value.arrayBuffer === 'function') {
        buffer = Buffer.from(await value.arrayBuffer())
      } else if (value && typeof value.text === 'function') {
        buffer = Buffer.from(await value.text(), 'utf-8')
      } else {
        buffer = Buffer.from(String(value || ''))
      }

      fs.writeFileSync(filePath, buffer)

      const meta = {
        key,
        size: buffer.length,
        contentType: options?.httpMetadata?.contentType || 'application/octet-stream',
        uploaded: new Date().toISOString(),
      }
      fs.writeFileSync(getMetaPath(key), JSON.stringify(meta))

      return {
        key,
        size: meta.size,
        uploaded: new Date(meta.uploaded),
      }
    },

    async get(key: string) {
      const filePath = getFilePath(key)
      if (!fs.existsSync(filePath)) {
        return null
      }

      const buffer = fs.readFileSync(filePath)
      let meta = {
        key,
        size: buffer.length,
        contentType: 'application/octet-stream',
        uploaded: new Date().toISOString(),
      }

      const metaPath = getMetaPath(key)
      if (fs.existsSync(metaPath)) {
        try {
          meta = { ...meta, ...JSON.parse(fs.readFileSync(metaPath, 'utf-8')) }
        } catch {
          // keep fallback
        }
      }

      const webStream = new Response(buffer).body

      return {
        key,
        size: meta.size,
        uploaded: new Date(meta.uploaded),
        httpMetadata: {
          contentType: meta.contentType,
        },
        body: webStream,
        async arrayBuffer() {
          return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
        },
        async text() {
          return buffer.toString('utf-8')
        },
      }
    },

    async delete(keys: string | string[]) {
      const keyList = Array.isArray(keys) ? keys : [keys]
      for (const k of keyList) {
        const fp = getFilePath(k)
        if (fs.existsSync(fp)) fs.unlinkSync(fp)
        const mp = getMetaPath(k)
        if (fs.existsSync(mp)) fs.unlinkSync(mp)
      }
    },

    async list({ cursor, limit = 1000 }: { cursor?: string; limit?: number } = {}) {
      if (!fs.existsSync(metaDir)) {
        return { objects: [], truncated: false }
      }
      const files = fs.readdirSync(metaDir).filter((f) => f.endsWith('.json'))
      const objects: Array<{ key: string; size: number; uploaded: Date }> = []

      for (const f of files) {
        try {
          const content = fs.readFileSync(path.join(metaDir, f), 'utf-8')
          const meta = JSON.parse(content)
          objects.push({
            key: meta.key,
            size: meta.size,
            uploaded: new Date(meta.uploaded),
          })
        } catch {
          // ignore corrupted metadata files
        }
      }

      const startIndex = cursor ? parseInt(cursor, 10) || 0 : 0
      const page = objects.slice(startIndex, startIndex + limit)
      const nextIndex = startIndex + limit
      const truncated = nextIndex < objects.length

      return {
        objects: page,
        truncated,
        cursor: truncated ? String(nextIndex) : undefined,
      }
    },
  }

  return r2Instance as R2Bucket
}
