// ============================================================
// WalletService (frontend) — balance, ledger, payment methods,
// recharge requests and coupon redemption.
// ============================================================

const WalletService = {
  /** GET /api/wallet/summary */
  async summary() {
    return API.get('/wallet/summary')
  },

  /** GET /api/wallet/transactions?page=N */
  async transactions(page = 1) {
    return API.get(`/wallet/transactions?page=${page}`)
  },

  /** GET /api/wallet/payment-methods */
  async paymentMethods() {
    return API.get('/wallet/payment-methods')
  },

  /**
   * POST /api/wallet/recharge-request — multipart with proof image.
   * Accepts either a ready FormData (from the recharge form element)
   * or an explicit field object.
   */
  async createRechargeRequest(input) {
    let fd
    if (input instanceof FormData) {
      fd = input
    } else {
      fd = new FormData()
      fd.append('method', input.method)
      fd.append('sender_number', input.senderNumber)
      fd.append('whatsapp_number', input.whatsappNumber)
      fd.append('transaction_id', input.transactionId)
      fd.append('amount', String(input.amount))
      if (input.proofFile) fd.append('proof_file', input.proofFile, input.proofFile.name)
    }
    return API.postForm('/wallet/recharge-request', fd)
  },

  /** GET /api/wallet/recharge-requests — my recharge history. */
  async rechargeRequests() {
    return API.get('/wallet/recharge-requests')
  },

  /** POST /api/wallet/redeem-coupon */
  async redeemCoupon(code) {
    return API.post('/wallet/redeem-coupon', { code })
  },
}
