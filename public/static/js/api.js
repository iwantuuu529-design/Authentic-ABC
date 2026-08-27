// ============================================================
// API client — thin fetch wrapper with cookie-based auth
// ============================================================
const API = {
  async request(method, path, data, isForm = false) {
    const opts = {
      method,
      credentials: 'include',
      headers: {},
    }
    if (data) {
      if (isForm) {
        opts.body = data // FormData — browser sets content-type with boundary
      } else {
        opts.headers['Content-Type'] = 'application/json'
        opts.body = JSON.stringify(data)
      }
    }
    let res
    try {
      res = await fetch(`/api${path}`, opts)
    } catch (err) {
      throw { success: false, message: 'নেটওয়ার্ক সংযোগ ব্যর্থ হয়েছে। ইন্টারনেট চেক করুন।' }
    }
    let json
    try {
      json = await res.json()
    } catch {
      json = { success: false, message: 'সার্ভার থেকে সঠিক উত্তর পাওয়া যায়নি।' }
    }
    if (!res.ok) {
      throw json
    }
    return json
  },
  get(path) { return this.request('GET', path) },
  post(path, data) { return this.request('POST', path, data) },
  put(path, data) { return this.request('PUT', path, data) },
  del(path) { return this.request('DELETE', path) },
  postForm(path, formData) { return this.request('POST', path, formData, true) },
  putForm(path, formData) { return this.request('PUT', path, formData, true) },
}
