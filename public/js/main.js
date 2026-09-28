// ป้องกัน XSS: ใช้ครอบข้อมูลจากผู้ใช้ทุกครั้งที่นำไปใส่ใน innerHTML หรือ template HTML
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// login หมดอายุ/token ไม่ถูกต้อง: API ตอบ 401 -> ล้างข้อมูล login แล้วพาไปหน้า login
// ครอบ fetch ไว้ที่เดียว ทุกหน้าที่โหลด main.js ได้ผลโดยไม่ต้องแก้ทีละหน้า
(function () {
  if (window.__authFetchWrapped || typeof window.fetch !== 'function') return;
  window.__authFetchWrapped = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const response = await originalFetch(input, init);
    try {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const headers = init && init.headers;
      const sentToken = !!(headers && (headers instanceof Headers
        ? headers.get('Authorization')
        : (headers.Authorization || headers.authorization)));
      if (response.status === 401 && sentToken && url.indexOf('/api/') !== -1 && url.indexOf('/api/auth/login') === -1) {
        ['token', 'userId', 'userName', 'userRole', 'studentId'].forEach(key => {
          try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
        });
        window.location.href = '/login.html?expired=1';
      }
    } catch (e) {
      console.error('Auth check failed:', e);
    }
    return response;
  };
})();

// สลิปถูกลบแล้ว: server ลบไฟล์ใน public/uploads ที่เก่ากว่า 30 วัน (cron) แต่ database ยังเก็บลิงก์ไว้
// nginx ตอบไฟล์ที่ไม่มีด้วย index.html (200) จึงต้องดู content-type แทน status
async function checkSlipAvailable(container, url) {
  if (!container || !url) return;
  try {
    const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    const type = (response.headers.get('content-type') || '').toLowerCase();
    if (!response.ok || type.includes('text/html')) {
      container.innerHTML = '<p class="text-muted mb-0"><i class="bi bi-file-earmark-x"></i> ' +
        escapeHtml(window.i18n?.[window.currentLang]?.requestDetail?.slipDeleted || 'ไฟล์หลักฐานการชำระเงินถูกลบแล้ว (ระบบเก็บไฟล์ไว้ 30 วัน)') + '</p>';
    }
  } catch (e) {
    // เช็กไม่ได้ก็แสดงตามเดิม
  }
}

// ย่อรูปสลิปก่อนอัปโหลด: ด้านยาวสุด 1600px, JPEG 85% (ยังอ่านตัวเลขในสลิปได้ชัด)
// คืนไฟล์เดิมถ้า: เป็น PDF/GIF, รูปเล็กอยู่แล้ว, browser เปิดรูปไม่ได้ (เช่น HEIC บน Chrome) หรือย่อแล้วไม่เล็กลง
async function resizeSlipImage(file, maxSide = 1600, quality = 0.85) {
  try {
    if (!file || !/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type || '')) return file;

    let source;
    let width;
    let height;
    if (typeof createImageBitmap === 'function') {
      // imageOrientation: หมุนรูปตาม EXIF ของกล้องมือถือ
      source = await createImageBitmap(file, { imageOrientation: 'from-image' });
      width = source.width;
      height = source.height;
    } else {
      const url = URL.createObjectURL(file);
      try {
        source = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = url;
        });
      } finally {
        URL.revokeObjectURL(url);
      }
      width = source.naturalWidth;
      height = source.naturalHeight;
    }

    const scale = Math.min(1, maxSide / Math.max(width, height));
    if (scale === 1 && file.size <= 1024 * 1024) return file; // เล็กอยู่แล้ว

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // PNG โปร่งใส -> พื้นขาว
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    if (source.close) source.close();

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;

    const baseName = (file.name || 'slip').replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch (error) {
    console.warn('resizeSlipImage: using original file', error);
    return file;
  }
}

// ข้อความวิธีรับเอกสาร เช่น "รับด้วยตนเอง (รังสิต)" — คืนค่าเป็น text ธรรมดา ต้อง escapeHtml ก่อนใส่ใน innerHTML
function formatDeliveryMethod(deliveryMethod, pickupLocation, lang) {
  lang = lang || window.currentLang || 'th';
  const texts = (window.i18n && window.i18n[lang] && window.i18n[lang].request) || {};
  if (deliveryMethod !== 'pickup') return texts.mail || 'รับทางไปรษณีย์';
  const fallbackLocations = { saphanmai: 'สะพานใหม่', rangsit: 'รังสิต' };
  const place = (texts.pickupLocations && texts.pickupLocations[pickupLocation]) || fallbackLocations[pickupLocation];
  return (texts.pickup || 'รับด้วยตนเอง') + (place ? ` (${place})` : '');
}

// ตรวจสอบสถานะการล็อกอินและอัปเดตเมนู
function checkAuthStatus() {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('userRole');
  
  const guestMenuItems = document.querySelectorAll('.guest-menu');
  const userMenuItems = document.querySelectorAll('.user-menu');
  const adminMenuItems = document.querySelectorAll('.admin-menu');
  
  if (token) {
    // ผู้ใช้ล็อกอินแล้ว
    guestMenuItems.forEach(item => item.style.display = 'none');
    userMenuItems.forEach(item => item.style.display = 'block');
    
    // ตรวจสอบว่าเป็นผู้ดูแลระบบหรือไม่
    if (userRole === 'admin') {
      adminMenuItems.forEach(item => item.style.display = 'block');
    } else {
      adminMenuItems.forEach(item => item.style.display = 'none');
    }
  } else {
    // ยังไม่ได้ล็อกอิน
    guestMenuItems.forEach(item => item.style.display = 'block');
    userMenuItems.forEach(item => item.style.display = 'none');
    adminMenuItems.forEach(item => item.style.display = 'none');
  }
}

// ออกจากระบบ
function logout() {
  localStorage.removeItem('studentId');
  localStorage.removeItem('token');
  localStorage.removeItem('userId');
  localStorage.removeItem('userName');
  localStorage.removeItem('userRole');
  
  window.location.href = '/index.html';
}

// แปลงสถานะเป็นข้อความภาษาไทย
function translateStatus(status, lang = 'th') {
  const statusTranslations = {
    'pending': {
      'th': 'รอดำเนินการ',
      'en': 'Pending',
      'zh': '待处理'
    },
    'processing': {
      'th': 'กำลังดำเนินการ',
      'en': 'Processing',
      'zh': '处理中'
    },
    'ready': {
      'th': 'พร้อมจัดส่ง/รับเอกสาร',
      'en': 'Ready',
      'zh': '准备好了'
    },
    'completed': {
      'th': 'เสร็จสิ้น',
      'en': 'Completed',
      'zh': '已完成'
    },
    'rejected': {
      'th': 'ถูกปฏิเสธ',
      'en': 'Rejected',
      'zh': '被拒绝'
    }
  };
  
  return statusTranslations[status]?.[lang] || status;
}

// สร้าง badge สำหรับแสดงสถานะ
function createStatusBadge(status) {
  const statusClass = `status-${status}`;
  const statusText = translateStatus(status, currentLang);
  
  return `<span class="status-badge ${statusClass}">${statusText}</span>`;
}

// แปลงวันที่เป็นรูปแบบที่อ่านง่าย
function formatDate(dateString, lang = 'th') {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok' // เพิ่มบรรทัดนี้
  };
  
  const locales = {
    'th': 'th-TH',
    'en': 'en-US',
    'zh': 'zh-CN'
  };
  
  return date.toLocaleDateString(locales[lang] || 'th-TH', options);
}

// รับ locale ตามภาษา
function getLocale(lang) {
  const locales = {
    'th': 'th-TH',
    'en': 'en-US',
    'zh': 'zh-CN'
  };
  
  return locales[lang] || 'th-TH';
}

// แปลงตัวเลขเป็นรูปแบบเงิน
function formatCurrency(amount, lang = 'th') {
  const currencies = {
    'th': 'THB',
    'en': 'THB',
    'zh': 'THB'
  };
  
  const formatter = new Intl.NumberFormat(getLocale(lang), {
    style: 'currency',
    currency: currencies[lang],
    minimumFractionDigits: 2
  });
  
  return formatter.format(amount);
}

// เพิ่มการฟังเหตุการณ์คลิกปุ่มออกจากระบบ
function setupLogoutButton() {
  const logoutButton = document.getElementById('logout');
  
  if (logoutButton) {
    logoutButton.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }
}

// ตรวจสอบว่าผู้ใช้ล็อกอินแล้วหรือยัง
function checkLogin() {
  const token = localStorage.getItem('token');
  
  if (!token) {
    window.location.href = '/login.html';
  }
}

// ตรวจสอบว่าผู้ใช้เป็นผู้ดูแลระบบหรือไม่
function checkAdmin() {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('userRole');
  
  if (!token || userRole !== 'admin') {
    window.location.href = '/login.html';
  }
}

// แสดงข้อความแจ้งเตือน - แก้ไขใหม่
function showAlert(message, type = 'success') {
  const alertContainer = document.getElementById('alert-container');
  
  if (!alertContainer) {
  //  console.warn('Alert container not found, message:', message);
    return;
  }
  
  // ตรวจสอบว่า message ไม่เป็น undefined หรือ null
  const displayMessage = message || 'เกิดข้อผิดพลาด';
  
  const alert = document.createElement('div');
  alert.className = `alert alert-${type} alert-dismissible fade show`;
  alert.role = 'alert';
  alert.innerHTML = `
    ${displayMessage}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  alertContainer.innerHTML = '';
  alertContainer.appendChild(alert);
  
  // ซ่อนข้อความแจ้งเตือนหลังจาก 5 วินาที
  setTimeout(() => {
    const alertElement = document.querySelector('.alert');
    if (alertElement) {
      alertElement.remove();
    }
  }, 5000);
}


// เพิ่มฟังก์ชันสำหรับ debug i18n
function debugI18n() {
 // console.log('=== i18n Debug Info ===');
 // console.log('window.i18n exists:', !!window.i18n);
 // console.log('currentLang:', window.currentLang);
  
  if (window.i18n && window.currentLang) {
 //   console.log('Current language data exists:', !!window.i18n[window.currentLang]);
  //  console.log('Dashboard section exists:', !!(window.i18n[window.currentLang] && window.i18n[window.currentLang].dashboard));
  //  console.log('Errors section exists:', !!(window.i18n[window.currentLang] && window.i18n[window.currentLang].errors));
  }
//  console.log('======================');
}

// เพิ่มการฟังเหตุการณ์เมื่อโหลดหน้าเว็บ - แก้ไขใหม่
document.addEventListener('DOMContentLoaded', () => {
//  console.log('main.js: DOM loaded');
  
  // Debug i18n status
  debugI18n();
  
  checkAuthStatus();
  setupLogoutButton();
});


