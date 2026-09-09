// ============================================================
// Profile — edit info, change password
// ============================================================

async function renderProfilePage() {
  // Admin/staff also need to reach this page (to change their own name/email/
  // password) — render with the correct nav+theme for whoever is actually
  // logged in, instead of forcing the customer-facing USER_NAV/shell.
  const isAdminUser = ['admin', 'staff'].includes(getStoredUser()?.role)
  qs('#app').innerHTML = `<div class="page-enter">${dashboardShell(isAdminUser ? ADMIN_NAV : USER_NAV, isAdminUser ? '' : '/dashboard/profile', isAdminUser)}</div>`
  bindShellEvents()

  const content = qs('#page-content')
  content.innerHTML = `<div class="max-w-3xl mx-auto space-y-6">${skeletonCard('h-64')}${skeletonCard('h-64')}</div>`

  let data
  try {
    data = { user: await AuthService.me() }
  } catch (err) {
    content.innerHTML = emptyState('fa-triangle-exclamation', 'প্রোফাইল লোড করা যায়নি', getErrorMessage(err))
    return
  }

  const user = data.user

  content.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-6">
      <div class="mb-2">
        <h1 class="text-2xl font-extrabold">প্রোফাইল সেটিংস</h1>
        <p class="text-slate-400 text-sm mt-1">আপনার একাউন্টের তথ্য পরিচালনা করুন</p>
      </div>

      <div class="glass rounded-2xl p-6 flex items-center gap-4">
        ${iconAvatar(user.name, 64)}
        <div>
          <h3 class="font-bold text-lg">${escapeHtml(user.name)}</h3>
          <p class="text-slate-400 text-sm">${escapeHtml(user.phone)}</p>
          <div class="flex items-center gap-2 mt-1.5">
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-400">${user.role === 'admin' ? 'এডমিন' : 'ইউজার'}</span>
            <span class="text-[10px] text-slate-500">যোগদান: ${formatDate(user.created_at)}</span>
          </div>
        </div>
      </div>

      <div class="glass rounded-2xl p-6">
        <h3 class="font-bold mb-4"><i class="fa-solid fa-user-pen text-brand-400 mr-2"></i>ব্যক্তিগত তথ্য পরিবর্তন</h3>
        <form id="profile-form" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-2">নাম <span class="text-rose-400">*</span></label>
              <input type="text" id="pf-name" required value="${escapeHtml(user.name)}" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-2 flex items-center justify-between">
                <span>মোবাইল নম্বর (লগইন আইডি)</span>
                <button type="button" id="pf-phone-edit-toggle" class="text-brand-400 text-xs font-semibold hover:underline">পরিবর্তন করুন</button>
              </label>
              <input type="text" id="pf-phone" value="${escapeHtml(user.phone)}" disabled class="w-full glass rounded-xl px-4 py-3 text-sm outline-none opacity-60 cursor-not-allowed" />
              <p id="pf-phone-hint" class="hidden text-[11px] text-amber-300 mt-1.5"><i class="fa-solid fa-triangle-exclamation mr-1"></i>নম্বর পরিবর্তন করলে নতুন নম্বরটিই আপনার লগইন আইডি হয়ে যাবে — নিচে বর্তমান পাসওয়ার্ড দিয়ে কনফার্ম করুন।</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-2">ইমেইল</label>
              <input type="email" id="pf-email" value="${escapeHtml(user.email || '')}" placeholder="you@example.com" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-2">WhatsApp নম্বর</label>
              <input type="text" id="pf-whatsapp" value="${escapeHtml(user.whatsapp || '')}" placeholder="01XXXXXXXXX" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow" />
            </div>
            <div id="pf-phone-confirm-wrap" class="hidden">
              <label class="block text-sm font-medium text-slate-300 mb-2">নম্বর পরিবর্তনের জন্য বর্তমান পাসওয়ার্ড <span class="text-rose-400">*</span></label>
              <input type="password" id="pf-phone-confirm-password" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow" />
            </div>
          </div>
          <button type="submit" id="pf-submit" class="btn-glow bg-brand-500 hover:bg-brand-600 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2">
            <i class="fa-solid fa-floppy-disk"></i> সংরক্ষণ করুন
          </button>
        </form>
      </div>

      <div class="glass rounded-2xl p-6">
        <h3 class="font-bold mb-4"><i class="fa-solid fa-lock text-amber-400 mr-2"></i>পাসওয়ার্ড পরিবর্তন</h3>
        <form id="password-form" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-2">বর্তমান পাসওয়ার্ড <span class="text-rose-400">*</span></label>
              <input type="password" id="pw-current" required class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-2">নতুন পাসওয়ার্ড <span class="text-rose-400">*</span></label>
              <input type="password" id="pw-new" required minlength="6" class="w-full glass rounded-xl px-4 py-3 text-sm outline-none input-glow" />
            </div>
          </div>
          <button type="submit" id="pw-submit" class="btn-glow bg-amber-500 hover:bg-amber-600 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2">
            <i class="fa-solid fa-key"></i> পাসওয়ার্ড পরিবর্তন করুন
          </button>
        </form>
      </div>
    </div>
  `

  let phoneEditEnabled = false
  qs('#pf-phone-edit-toggle').addEventListener('click', () => {
    phoneEditEnabled = !phoneEditEnabled
    const phoneInput = qs('#pf-phone')
    phoneInput.disabled = !phoneEditEnabled
    phoneInput.classList.toggle('opacity-60', !phoneEditEnabled)
    phoneInput.classList.toggle('cursor-not-allowed', !phoneEditEnabled)
    qs('#pf-phone-hint').classList.toggle('hidden', !phoneEditEnabled)
    qs('#pf-phone-confirm-wrap').classList.toggle('hidden', !phoneEditEnabled)
    qs('#pf-phone-edit-toggle').textContent = phoneEditEnabled ? 'বাতিল করুন' : 'পরিবর্তন করুন'
    if (!phoneEditEnabled) phoneInput.value = user.phone
  })

  qs('#profile-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = qs('#pf-submit')
    btn.disabled = true
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> সংরক্ষণ হচ্ছে...`
    try {
      const payload = {
        name: qs('#pf-name').value,
        email: qs('#pf-email').value,
        whatsapp: qs('#pf-whatsapp').value,
      }
      if (phoneEditEnabled) {
        const newPhone = qs('#pf-phone').value.trim()
        if (newPhone !== user.phone) {
          payload.phone = newPhone
          payload.current_password = qs('#pf-phone-confirm-password').value
        }
      }
      const res = await AuthService.updateProfile(payload)
      showToast(res.message, 'success')
      const u = getStoredUser()
      if (u) setStoredUser({ ...u, name: qs('#pf-name').value, phone: res.phone || u.phone })
      if (res.phone && res.phone !== user.phone) {
        // Login ID changed — reload so every part of the UI (topbar, etc.) reflects it.
        setTimeout(() => window.location.reload(), 900)
      }
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      btn.disabled = false
      btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> সংরক্ষণ করুন`
    }
  })

  qs('#password-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = qs('#pw-submit')
    btn.disabled = true
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> পরিবর্তন হচ্ছে...`
    try {
      const res = await AuthService.changePassword({
        current_password: qs('#pw-current').value,
        new_password: qs('#pw-new').value,
      })
      showToast(res.message, 'success')
      qs('#password-form').reset()
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      btn.disabled = false
      btn.innerHTML = `<i class="fa-solid fa-key"></i> পাসওয়ার্ড পরিবর্তন করুন`
    }
  })
}
