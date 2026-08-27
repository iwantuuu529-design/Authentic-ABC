// Wallet ledger engine.
// D1 (SQLite over HTTP) does not give us a full interactive multi-statement
// transaction with branching logic, so debits use an atomic conditional
// UPDATE (`WHERE balance >= amount`) to guarantee we never oversell balance
// even under concurrent requests — the safest pattern available on this runtime.

export interface WalletResult {
  success: boolean
  balanceAfter?: number
  balanceBefore?: number
  reason?: string
}

export async function creditWallet(
  db: D1Database,
  userId: number,
  amount: number,
  type: string,
  referenceType: string | null,
  referenceId: number | null,
  description: string
): Promise<WalletResult> {
  if (amount <= 0) return { success: false, reason: 'invalid_amount' }

  const before = await db.prepare('SELECT balance FROM users WHERE id = ?').bind(userId).first<{
    balance: number
  }>()
  if (!before) return { success: false, reason: 'user_not_found' }

  await db.prepare('UPDATE users SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(amount, userId)
    .run()

  const after = await db.prepare('SELECT balance FROM users WHERE id = ?').bind(userId).first<{
    balance: number
  }>()

  await db
    .prepare(
      `INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(userId, type, amount, before.balance, after?.balance ?? before.balance + amount, referenceType, referenceId, description)
    .run()

  return { success: true, balanceBefore: before.balance, balanceAfter: after?.balance ?? before.balance + amount }
}

export async function debitWallet(
  db: D1Database,
  userId: number,
  amount: number,
  type: string,
  referenceType: string | null,
  referenceId: number | null,
  description: string
): Promise<WalletResult> {
  if (amount <= 0) return { success: false, reason: 'invalid_amount' }

  const before = await db.prepare('SELECT balance FROM users WHERE id = ?').bind(userId).first<{
    balance: number
  }>()
  if (!before) return { success: false, reason: 'user_not_found' }

  // Atomic conditional debit — prevents race conditions / overdraft.
  const result = await db
    .prepare('UPDATE users SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND balance >= ?')
    .bind(amount, userId, amount)
    .run()

  if (!result.meta.changes) {
    return { success: false, reason: 'insufficient_balance', balanceBefore: before.balance }
  }

  const after = await db.prepare('SELECT balance FROM users WHERE id = ?').bind(userId).first<{
    balance: number
  }>()

  await db
    .prepare(
      `INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(userId, type, -amount, before.balance, after?.balance ?? before.balance - amount, referenceType, referenceId, description)
    .run()

  return { success: true, balanceBefore: before.balance, balanceAfter: after?.balance ?? before.balance - amount }
}
