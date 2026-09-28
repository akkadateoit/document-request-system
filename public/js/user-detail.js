// escapeHtml อยู่ใน main.js — สำรองไว้เผื่อ browser/Cloudflare ยัง cache main.js เวอร์ชันเก่าอยู่
if (typeof escapeHtml !== 'function') { window.escapeHtml = function (v) { return v === null || v === undefined ? '' : String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }; }

// ตรวจสอบว่าเป็นผู้ดูแลระบบหรือไม่
document.addEventListener('DOMContentLoaded', () => {
  console.log('User detail page loaded');
  checkAdmin();
  loadUserDetails();
  setupEventListeners();
  setupEditFormValidation();
});

let currentUserId = null;
let currentUserData = null; // เก็บข้อมูลผู้ใช้ปัจจุบัน

// ตั้งค่าการฟังเหตุการณ์
function setupEventListeners() {
  // ปุ่มลบผู้ใช้
  const deleteUserBtn = document.getElementById('delete-user-btn');
  if (deleteUserBtn) {
    deleteUserBtn.addEventListener('click', setupDeleteModal);
  }

  // ปุ่มยืนยันการลบ
  const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', deleteUser);
  }

  // ช่อง input สำหรับยืนยันการลบ
  const confirmDeleteInput = document.getElementById('confirm-delete-input');
  if (confirmDeleteInput) {
    confirmDeleteInput.addEventListener('input', (e) => {
      const confirmBtn = document.getElementById('confirm-delete-btn');
      if (confirmBtn) {
        confirmBtn.disabled = e.target.value !== 'DELETE';
      }
    });
  }

  // ปุ่มรีเซ็ตรหัสผ่าน
  const resetPasswordBtn = document.getElementById('reset-password-btn');
  if (resetPasswordBtn) {
    resetPasswordBtn.addEventListener('click', () => {
      const resetModal = new bootstrap.Modal(document.getElementById('resetPasswordModal'));
      resetModal.show();
    });
  }

  // ปุ่มยืนยันรีเซ็ตรหัสผ่าน
  const confirmResetBtn = document.getElementById('confirm-reset-password-btn');
  if (confirmResetBtn) {
    confirmResetBtn.addEventListener('click', resetUserPassword);
  }

  // ปุ่มแก้ไขข้อมูลผู้ใช้
  const editUserBtn = document.getElementById('edit-user-btn');
  if (editUserBtn) {
    editUserBtn.addEventListener('click', setupEditModal);
    console.log('Edit user button listener attached');
  } else {
    console.error('Edit user button not found');
  }

  // ปุ่มบันทึกการแก้ไข - เพิ่ม event listener
  const saveUserBtn = document.getElementById('save-user-btn');
  if (saveUserBtn) {
    saveUserBtn.addEventListener('click', (e) => {
      console.log('Save button clicked');
      e.preventDefault(); // ป้องกันการ submit form
      saveUserChanges();
    });
    console.log('Save user button listener attached');
  } else {
    console.error('Save user button not found');
  }

  // เพิ่ม event listener สำหรับ form submit
  const editUserForm = document.getElementById('edit-user-form');
  if (editUserForm) {
    editUserForm.addEventListener('submit', (e) => {
      console.log('Form submitted');
      e.preventDefault();
      saveUserChanges();
    });
  }
}

// ตั้งค่าการตรวจสอบฟอร์มแก้ไขข้อมูล
function setupEditFormValidation() {
  // ตั้งค่าวันที่สูงสุดสำหรับวันเกิด
  const birthDateInput = document.getElementById('edit-birth-date');
  if (birthDateInput) {
    const today = new Date();
    const maxDate = today.toISOString().split('T')[0];
    birthDateInput.setAttribute('max', maxDate);
    
    const minDate = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());
    birthDateInput.setAttribute('min', minDate.toISOString().split('T')[0]);
  }
  
  // ตั้งค่าการตรวจสอบหมายเลขบัตรประชาชน/Passport
  const idNumberInput = document.getElementById('edit-id-number');
  if (idNumberInput) {
    idNumberInput.addEventListener('input', function(e) {
      const value = e.target.value.trim();
      const parentDiv = e.target.parentNode;
      let helpText = parentDiv.querySelector('.form-text small');
      
      if (!helpText) {
        console.warn('Help text not found for id-number input');
        return;
      }
      
      if (value.length === 0) {
        helpText.textContent = 'ไม่จำเป็นต้องกรอก - รูปแบบ: บัตรประชาชน 13 หลัก หรือ Passport 6-12 ตัวอักษร';
        helpText.className = 'text-muted';
        return;
      }
      
      // ตรวจสอบรูปแบบ
      if (/^[0-9]{13}$/.test(value)) {
        helpText.textContent = '✓ รูปแบบบัตรประชาชนถูกต้อง';
        helpText.className = 'text-success';
      } else if (/^[A-Za-z0-9]{6,12}$/.test(value)) {
        helpText.textContent = '✓ รูปแบบ Passport ถูกต้อง';
        helpText.className = 'text-success';
      } else {
        if (value.length < 6) {
          helpText.textContent = '⚠ หมายเลขสั้นเกินไป';
        } else if (value.length > 13) {
          helpText.textContent = '⚠ หมายเลขยาวเกินไป';
        } else if (/^[0-9]+$/.test(value) && value.length !== 13) {
          helpText.textContent = '⚠ บัตรประชาชนต้องเป็น 13 หลัก';
        } else {
          helpText.textContent = '⚠ รูปแบบไม่ถูกต้อง';
        }
        helpText.className = 'text-warning';
      }
    });
  }
}

// โหลดรายละเอียดผู้ใช้
async function loadUserDetails() {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      window.location.href = '../login.html';
      return;
    }
    
    // รับ ID ผู้ใช้จาก URL
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id');
    
    if (!userId) {
      window.location.href = 'users.html';
      return;
    }
    
    currentUserId = userId;
    console.log('Loading user details for ID:', userId);
    
    // โหลดข้อมูลผู้ใช้
    const userResponse = await fetch(`/api/admin/user/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!userResponse.ok) {
      throw new Error('Failed to load user details');
    }
    
    const user = await userResponse.json();
    console.log('User details loaded:', user);
    
    // เก็บข้อมูลผู้ใช้ไว้ใช้งาน
    currentUserData = user;
    
    displayUserDetails(user);
    
    // โหลดประวัติการขอเอกสารของผู้ใช้
    await loadUserRequests(userId);
    
  } catch (error) {
    console.error('Error loading user details:', error);
    showAdminAlert('เกิดข้อผิดพลาดในการโหลดข้อมูลผู้ใช้', 'danger');
  }
}


// แสดงรายละเอียดผู้ใช้
function displayUserDetails(user) {
  try {
    console.log('Displaying user details:', user);
    
    // ข้อมูลพื้นฐาน
    document.getElementById('user-student-id').textContent = user.student_id || '-';
    document.getElementById('user-full-name').textContent = user.full_name || '-';
    document.getElementById('user-email').textContent = user.email || '-';
    document.getElementById('user-phone').textContent = user.phone || '-';
    document.getElementById('user-faculty').textContent = user.faculty || '-';
    
    // แสดงวันเดือนปีเกิด
    const birthDateElement = document.getElementById('user-birth-date');
    if (birthDateElement) {
      if (user.birth_date) {
        const birthDate = new Date(user.birth_date);
        console.log('Birth date raw:', user.birth_date, 'Parsed:', birthDate);
        
        const options = {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'Asia/Bangkok'
        };
        
        const formattedDate = birthDate.toLocaleDateString('th-TH', options);
        console.log('Formatted birth date:', formattedDate);
        
        birthDateElement.textContent = formattedDate;
      } else {
        birthDateElement.textContent = '-';
      }
    }
    
    // แสดงหมายเลขบัตรประชาชน/Passport
    const idNumberElement = document.getElementById('user-id-number');
    if (idNumberElement) {
      if (user.id_number) {
        console.log('ID Number raw:', user.id_number);
        
        const maskedIdNumber = maskIdNumber(user.id_number);
        console.log('Masked ID Number:', maskedIdNumber);
        
        idNumberElement.textContent = maskedIdNumber;
        idNumberElement.title = 'คลิกเพื่อดูหมายเลขเต็ม';
        idNumberElement.style.cursor = 'pointer';
        
        // เพิ่มการคลิกเพื่อแสดงหมายเลขเต็ม
        idNumberElement.addEventListener('click', function() {
          if (this.textContent === maskedIdNumber) {
            this.textContent = user.id_number;
            this.title = 'คลิกเพื่อซ่อนหมายเลข';
          } else {
            this.textContent = maskedIdNumber;
            this.title = 'คลิกเพื่อดูหมายเลขเต็ม';
          }
        });
      } else {
        console.log('No ID number found');
        idNumberElement.textContent = '-';
      }
    }
    
    // วันที่ลงทะเบียน
    const joinDateElement = document.getElementById('user-join-date');
    if (joinDateElement) {
      joinDateElement.textContent = formatDate(user.created_at, window.currentLang || 'th');
    }
    
    // แสดง badge บทบาท
    const roleElement = document.getElementById('user-role-badge');
    if (roleElement) {
      const badgeClass = user.role === 'admin' ? 'bg-danger' : 'bg-primary';
      const roleText = user.role === 'admin' ? 
        (window.i18n?.[window.currentLang]?.admin?.users?.admin || 'ผู้ดูแลระบบ') : 
        (window.i18n?.[window.currentLang]?.admin?.users?.student || 'นักศึกษา');
      
      roleElement.innerHTML = `<span class="badge ${badgeClass}">${roleText}</span>`;
    }
    
    // ซ่อนปุ่มลบและแก้ไขสำหรับผู้ดูแลระบบ
    if (user.role === 'admin') {
      const deleteBtn = document.getElementById('delete-user-btn');
      if (deleteBtn) {
        deleteBtn.style.display = 'none';
      }
      
      const editBtn = document.getElementById('edit-user-btn');
      if (editBtn) {
        const currentUserId = localStorage.getItem('userId');
        if (user.id.toString() !== currentUserId) {
          editBtn.style.display = 'none';
        }
      }
    }
    
  } catch (error) {
    console.error('Error displaying user details:', error);
  }
}

// ฟังก์ชันซ่อนบางส่วนของหมายเลขบัตรประชาชน/Passport
function maskIdNumber(idNumber) {
  if (!idNumber) return '-';
  
  const str = idNumber.toString();
  
  // ถ้าเป็นบัตรประชาชน (13 หลัก)
  if (str.length === 13 && /^[0-9]+$/.test(str)) {
    return str.substring(0, 1) + '-' + str.substring(1, 5) + '-' + '*'.repeat(5) + '-' + str.substring(10, 12) + '-' + str.substring(12);
  }
  
  // ถ้าเป็น Passport หรืออื่นๆ
  if (str.length >= 6) {
    return str.substring(0, 2) + '*'.repeat(str.length - 4) + str.substring(str.length - 2);
  }
  
  return str;
}

// โหลดประวัติการขอเอกสารของผู้ใช้
async function loadUserRequests(userId) {
  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`/api/admin/user/${userId}/requests?lang=${currentLang}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      console.warn('Failed to load user requests, may not be implemented yet');
      displayUserRequests([]);
      return;
    }
    
    const requests = await response.json();
    console.log('User requests loaded:', requests.length);
    
    displayUserRequests(requests);
    updateStatistics(requests);
    
  } catch (error) {
    console.error('Error loading user requests:', error);
    displayUserRequests([]);
  }
}

// แสดงประวัติการขอเอกสาร
function displayUserRequests(requests) {
  const tableBody = document.getElementById('user-requests-table');
  
  if (!tableBody) {
    console.error('User requests table not found');
    return;
  }
  
  tableBody.innerHTML = '';
  
  if (requests.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `
      <td colspan="6" class="text-center">ไม่พบประวัติการขอเอกสาร</td>
    `;
    tableBody.appendChild(emptyRow);
    return;
  }
  
  requests.forEach(request => {
    const row = document.createElement('tr');
    
    row.innerHTML = `
      <td>${request.id}</td>
      <td>${escapeHtml(request.document_name || '-')}</td>
      <td>${formatDate(request.created_at, currentLang)}</td>
      <td>${createStatusBadge(request.status)}</td>
      <td>${formatCurrency(request.total_price, currentLang)}</td>
      <td>
        <a href="request-detail.html?id=${request.id}" class="btn btn-sm btn-primary">
          <i class="bi bi-eye"></i> ดูรายละเอียด
        </a>
      </td>
    `;
    
    tableBody.appendChild(row);
  });
}

// อัปเดตสถิติการใช้งาน
function updateStatistics(requests) {
  try {
    const totalRequests = requests.length;
    const completedRequests = requests.filter(r => r.status === 'completed').length;
    const pendingRequests = requests.filter(r => r.status === 'pending').length;
    const totalSpent = requests.reduce((sum, r) => sum + parseFloat(r.total_price || 0), 0);
    
    document.getElementById('total-requests').textContent = totalRequests;
    document.getElementById('completed-requests').textContent = completedRequests;
    document.getElementById('pending-requests').textContent = pendingRequests;
    document.getElementById('total-spent').textContent = formatCurrency(totalSpent, currentLang);
    
  } catch (error) {
    console.error('Error updating statistics:', error);
  }
}

// ตั้งค่า Modal การลบ
function setupDeleteModal() {
  const userStudentId = document.getElementById('user-student-id').textContent;
  const userFullName = document.getElementById('user-full-name').textContent;
  const userEmail = document.getElementById('user-email').textContent;
  
  document.getElementById('delete-user-student-id').textContent = userStudentId;
  document.getElementById('delete-user-name').textContent = userFullName;
  document.getElementById('delete-user-email').textContent = userEmail;
  
  // รีเซ็ตช่อง input
  const confirmInput = document.getElementById('confirm-delete-input');
  if (confirmInput) {
    confirmInput.value = '';
  }
  
  const confirmBtn = document.getElementById('confirm-delete-btn');
  if (confirmBtn) {
    confirmBtn.disabled = true;
  }
}

// รายชื่อคณะสำหรับ dropdown (โหลดครั้งเดียว)
let facultyNamesCache = null;

async function fillFacultyOptions(currentFaculty) {
  const select = document.getElementById('edit-faculty');
  if (!select) return;
  
  // ถ้ายังเป็น input แบบเดิม (หน้าเว็บเวอร์ชันเก่าใน cache) ให้ใส่ค่าตรงๆ
  if (select.tagName !== 'SELECT') {
    select.value = currentFaculty;
    return;
  }
  
  if (!facultyNamesCache) {
    try {
      const response = await fetch('/api/documents/faculties?lang=th');
      facultyNamesCache = response.ok ? (await response.json()).map(f => f.name) : [];
    } catch (error) {
      console.error('Error loading faculties:', error);
      facultyNamesCache = [];
    }
  }
  
  // ค่าที่ผู้ใช้มีอยู่อาจไม่อยู่ในรายชื่อ (เช่น ลงทะเบียนตอนเลือกภาษาอังกฤษ หรือ 'Admin') ให้คงไว้เป็นตัวเลือกด้วย
  const names = [...facultyNamesCache];
  if (currentFaculty && !names.includes(currentFaculty)) names.unshift(currentFaculty);
  
  select.innerHTML = '<option value="">-- เลือกคณะ --</option>';
  names.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });
  select.value = currentFaculty;
}

// ตั้งค่า Modal การแก้ไขข้อมูล
function setupEditModal() {
  console.log('Setting up edit modal with data:', currentUserData);
  
  if (!currentUserData) {
    showAdminAlert('ไม่พบข้อมูลผู้ใช้', 'danger');
    return;
  }
  
  // กรอกข้อมูลปัจจุบันลงในฟอร์ม
  document.getElementById('edit-student-id').value = currentUserData.student_id || '';
  document.getElementById('edit-full-name').value = currentUserData.full_name || '';
  document.getElementById('edit-email').value = currentUserData.email || '';
  document.getElementById('edit-phone').value = currentUserData.phone || '';
  fillFacultyOptions(currentUserData.faculty || '');
  
  // บทบาท: ห้ามเปลี่ยนบทบาทของบัญชีที่กำลังล็อกอินอยู่ (กันล็อกตัวเองออกจากหน้า admin)
  const roleSelect = document.getElementById('edit-role');
  if (roleSelect) {
    roleSelect.value = currentUserData.role === 'admin' ? 'admin' : 'student';
    const isSelf = String(currentUserId) === String(localStorage.getItem('userId'));
    roleSelect.disabled = isSelf;
    const roleHelp = document.getElementById('edit-role-help');
    if (roleHelp) {
      roleHelp.textContent = isSelf ? 'ไม่สามารถเปลี่ยนบทบาทของบัญชีที่กำลังใช้งานอยู่ได้' : 'ผู้ดูแลระบบเข้าหน้าจัดการระบบได้ทั้งหมด';
    }
  }
  
  // ล้างช่องรหัสผ่านทุกครั้งที่เปิด modal
  ['edit-password', 'edit-password-confirm'].forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) field.value = '';
  });
  
  // แปลงวันเกิดเป็นรูปแบบ YYYY-MM-DD
  if (currentUserData.birth_date) {
    const birthDate = new Date(currentUserData.birth_date);
    const formattedDate = birthDate.toISOString().split('T')[0];
    document.getElementById('edit-birth-date').value = formattedDate;
  } else {
    document.getElementById('edit-birth-date').value = '';
  }
  
  // กรอกหมายเลขบัตร (แสดงหมายเลขเต็ม)
  document.getElementById('edit-id-number').value = currentUserData.id_number || '';
  
  // รีเซ็ต help text
  const idNumberInput = document.getElementById('edit-id-number');
  if (idNumberInput) {
    const helpText = idNumberInput.parentNode.querySelector('.form-text small');
    if (helpText) {
      helpText.textContent = 'ไม่จำเป็นต้องกรอก - รูปแบบ: บัตรประชาชน 13 หลัก หรือ Passport 6-12 ตัวอักษร';
      helpText.className = 'text-muted';
    }
  }
  
  console.log('Edit modal setup complete');
}

// บันทึกการแก้ไขข้อมูลผู้ใช้
async function saveUserChanges() {
  console.log('saveUserChanges called');
  
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.error('No token found');
      window.location.href = '../login.html';
      return;
    }
    
    if (!currentUserId) {
      console.error('No current user ID');
      showAdminAlert('ไม่พบ ID ผู้ใช้', 'danger');
      return;
    }
    
    // ตรวจสอบฟอร์ม
    const form = document.getElementById('edit-user-form');
    if (!form.checkValidity()) {
      console.log('Form validation failed');
      form.reportValidity();
      return;
    }
    
    // รวบรวมข้อมูลจากฟอร์ม
    const formData = {
      student_id: document.getElementById('edit-student-id').value.trim(),
      full_name: document.getElementById('edit-full-name').value.trim(),
      email: document.getElementById('edit-email').value.trim(),
      phone: document.getElementById('edit-phone').value.trim(),
      faculty: document.getElementById('edit-faculty').value.trim() || null,
      birth_date: document.getElementById('edit-birth-date').value || null,
      id_number: document.getElementById('edit-id-number').value.trim() || null
    };
    
    // บทบาท (ไม่ส่งถ้าถูกล็อกไว้ เพราะเป็นบัญชีของตัวเอง)
    const roleSelect = document.getElementById('edit-role');
    if (roleSelect && !roleSelect.disabled) {
      formData.role = roleSelect.value;
    }
    
    // รหัสผ่านใหม่ (ถ้ากรอก)
    const newPassword = document.getElementById('edit-password')?.value || '';
    const confirmPassword = document.getElementById('edit-password-confirm')?.value || '';
    if (newPassword || confirmPassword) {
      if (newPassword.length < 6) {
        showAdminAlert('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร', 'danger');
        return;
      }
      if (newPassword !== confirmPassword) {
        showAdminAlert('รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน', 'danger');
        return;
      }
      formData.password = newPassword;
    }
    
    console.log('Form data collected:', { ...formData, password: formData.password ? '***' : undefined });
    
    // ตรวจสอบรูปแบบหมายเลขบัตรประชาชน/Passport (ถ้ามีการกรอก)
    if (formData.id_number) {
      if (!/^[0-9]{13}$/.test(formData.id_number) && !/^[A-Za-z0-9]{6,12}$/.test(formData.id_number)) {
        showAdminAlert('รูปแบบหมายเลขบัตรประชาชนหรือ Passport ไม่ถูกต้อง', 'danger');
        return;
      }
    }
    
    console.log('Sending PUT request to:', `/api/admin/user/${currentUserId}`);
    
    const response = await fetch(`/api/admin/user/${currentUserId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });
    
    console.log('Response status:', response.status);
    
    const data = await response.json();
    console.log('Response data:', data);
    
    if (response.ok) {
      showAdminAlert('บันทึกข้อมูลผู้ใช้สำเร็จ', 'success');
      
      // ปิด Modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('editUserModal'));
      if (modal) {
        modal.hide();
      }
      
      // โหลดข้อมูลใหม่
      await loadUserDetails();
      
    } else {
      showAdminAlert(data.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูลผู้ใช้', 'danger');
    }
    
  } catch (error) {
    console.error('Error saving user changes:', error);
    showAdminAlert('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์', 'danger');
  }
}

// ลบผู้ใช้
async function deleteUser() {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      window.location.href = '../login.html';
      return;
    }
    
    if (!currentUserId) {
      showAdminAlert('ไม่พบ ID ผู้ใช้', 'danger');
      return;
    }
    
    console.log('Deleting user:', currentUserId);
    
    const response = await fetch(`/api/admin/user/${currentUserId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showAdminAlert('ลบผู้ใช้สำเร็จ', 'success');
      
      // ปิด Modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('deleteUserModal'));
      if (modal) {
        modal.hide();
      }
      
      // กลับไปหน้ารายการผู้ใช้
      setTimeout(() => {
        window.location.href = 'users.html';
      }, 2000);
      
    } else {
      showAdminAlert(data.message || 'เกิดข้อผิดพลาดในการลบผู้ใช้', 'danger');
    }
    
  } catch (error) {
    console.error('Error deleting user:', error);
    showAdminAlert('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์', 'danger');
  }
}

// รีเซ็ตรหัสผ่าน
async function resetUserPassword() {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      window.location.href = '../login.html';
      return;
    }
    
    if (!currentUserId) {
      showAdminAlert('ไม่พบ ID ผู้ใช้', 'danger');
      return;
    }
    
    console.log('Resetting password for user:', currentUserId);
    
    const response = await fetch(`/api/admin/user/${currentUserId}/reset-password`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showAdminAlert('รีเซ็ตรหัสผ่านสำเร็จ รหัสผ่านใหม่: 123456', 'success');
      
      // ปิด Modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('resetPasswordModal'));
      if (modal) {
        modal.hide();
      }
      
    } else {
      showAdminAlert(data.message || 'เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน', 'danger');
    }
    
  } catch (error) {
    console.error('Error resetting password:', error);
    showAdminAlert('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์', 'danger');
  }
}

// ฟังก์ชันสำหรับใช้จากฟังก์ชันอื่น
window.loadUserDetails = loadUserDetails;
window.deleteUser = deleteUser;
window.resetUserPassword = resetUserPassword;
window.saveUserChanges = saveUserChanges;
