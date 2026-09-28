// ลืมรหัสผ่าน (forgot-password.html) และตั้งรหัสผ่านใหม่จากลิงก์ในอีเมล (reset-password.html)

function prText(path, fallback) {
  const parts = path.split('.');
  let value = window.i18n && window.i18n[window.currentLang || 'th'];
  for (const part of parts) value = value && value[part];
  return typeof value === 'string' ? value : fallback;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  let data = {};
  try { data = await response.json(); } catch (e) { /* ignore */ }
  return { ok: response.ok, status: response.status, data };
}

// ---------- หน้าลืมรหัสผ่าน ----------
function setupForgotPassword(form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.getElementById('forgot-submit');
    const email = document.getElementById('email').value.trim();
    if (!email) return;

    button.disabled = true;
    try {
      const { ok, data } = await postJson('/api/auth/forgot-password', { email });
      if (ok) {
        showAlert(prText('forgotPassword.sent', data.message), 'success');
        form.reset();
      } else {
        showAlert(data.message || prText('errors.serverError', 'เกิดข้อผิดพลาด กรุณาลองใหม่ภายหลัง'), 'danger');
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      showAlert(prText('errors.serverError', 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์'), 'danger');
    } finally {
      button.disabled = false;
    }
  });
}

// ---------- หน้าตั้งรหัสผ่านใหม่ ----------
function readResetToken() {
  // เอา token ออกจากแถบที่อยู่ทันที (ไม่ให้ค้างใน history) แต่เก็บไว้ใน sessionStorage เผื่อกด refresh
  const fromUrl = new URLSearchParams(window.location.search).get('token');
  if (fromUrl) {
    try { sessionStorage.setItem('resetToken', fromUrl); } catch (e) { /* ignore */ }
    try { history.replaceState(null, '', window.location.pathname); } catch (e) { /* ignore */ }
    return fromUrl;
  }
  try { return sessionStorage.getItem('resetToken') || ''; } catch (e) { return ''; }
}

function clearResetToken() {
  try { sessionStorage.removeItem('resetToken'); } catch (e) { /* ignore */ }
}

async function setupResetPassword(form) {
  const checking = document.getElementById('reset-checking');
  const requestNewLink = document.getElementById('request-new-link');
  const token = readResetToken();

  const showInvalid = (message) => {
    checking.style.display = 'none';
    form.style.display = 'none';
    requestNewLink.style.display = 'inline';
    showAlert(message || prText('resetPassword.invalidLink', 'ลิงก์หมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่'), 'danger');
  };

  if (!token) {
    showInvalid();
    return;
  }

  try {
    const { ok, data } = await postJson('/api/auth/reset-password/check', { token });
    if (!ok || !data.valid) {
      clearResetToken();
      showInvalid(prText('resetPassword.invalidLink', data.message));
      return;
    }
    document.getElementById('reset-student-id').value = data.student_id || '';
    checking.style.display = 'none';
    form.style.display = 'block';
  } catch (error) {
    console.error('Reset check error:', error);
    showInvalid(prText('errors.serverError', 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์'));
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = document.getElementById('new-password').value;
    const confirm = document.getElementById('confirm-password').value;

    if (password.length < 6) {
      showAlert(prText('resetPassword.tooShort', 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร'), 'danger');
      return;
    }
    if (password !== confirm) {
      showAlert(prText('resetPassword.mismatch', 'รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน'), 'danger');
      return;
    }

    const button = document.getElementById('reset-submit');
    button.disabled = true;
    try {
      const { ok, data } = await postJson('/api/auth/reset-password', { token, password });
      if (ok) {
        clearResetToken();
        form.style.display = 'none';
        showAlert(prText('resetPassword.success', data.message), 'success');
        setTimeout(() => { window.location.href = 'login.html'; }, 2500);
      } else {
        button.disabled = false;
        showAlert(data.message || prText('errors.serverError', 'เกิดข้อผิดพลาด'), 'danger');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      button.disabled = false;
      showAlert(prText('errors.serverError', 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์'), 'danger');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const forgotForm = document.getElementById('forgot-password-form');
  if (forgotForm) setupForgotPassword(forgotForm);

  const resetForm = document.getElementById('reset-password-form');
  if (resetForm) setupResetPassword(resetForm);
});
