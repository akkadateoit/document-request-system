const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendMail, isMailConfigured } = require('../services/mailer');
require('dotenv').config();

// จำกัดการ login ผิดซ้ำๆ (กันการเดารหัสผ่าน) — เก็บในหน่วยความจำ รีเซ็ตเมื่อ restart
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_PER_ACCOUNT_IP = 5;   // ต่อ (IP + รหัสนักศึกษา)
const MAX_FAILS_PER_IP = 30;          // ต่อ IP รวมทุกบัญชี
const loginFailures = new Map();      // key -> { count, first }

// IP จริงของผู้ใช้: ผ่าน Cloudflare -> nginx -> node
function clientIp(req) {
  return req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.ip || 'unknown';
}

function failureCount(key) {
  const entry = loginFailures.get(key);
  if (!entry) return 0;
  if (Date.now() - entry.first > LOGIN_WINDOW_MS) {
    loginFailures.delete(key);
    return 0;
  }
  return entry.count;
}

function recordFailure(key) {
  const entry = loginFailures.get(key);
  if (!entry || Date.now() - entry.first > LOGIN_WINDOW_MS) {
    loginFailures.set(key, { count: 1, first: Date.now() });
  } else {
    entry.count++;
  }
}

// ล้างรายการที่หมดอายุทุก 5 นาที
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginFailures) {
    if (now - entry.first > LOGIN_WINDOW_MS) loginFailures.delete(key);
  }
}, 5 * 60 * 1000).unref();

// ===== ลืมรหัสผ่าน =====
const RESET_TOKEN_TTL_MIN = 30;
const RESET_WINDOW_MS = 60 * 60 * 1000;
const MAX_RESET_REQUESTS_PER_EMAIL = 3;  // ต่อชั่วโมง
const MAX_RESET_REQUESTS_PER_IP = 10;    // ต่อชั่วโมง
const resetRequests = new Map();         // key -> { count, first }

function hitResetLimit(key, max) {
  const now = Date.now();
  const entry = resetRequests.get(key);
  if (!entry || now - entry.first > RESET_WINDOW_MS) {
    resetRequests.set(key, { count: 1, first: now });
    return false;
  }
  entry.count++;
  return entry.count > max;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of resetRequests) {
    if (now - entry.first > RESET_WINDOW_MS) resetRequests.delete(key);
  }
}, 10 * 60 * 1000).unref();

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function buildResetEmail(user, link) {
  const subject = 'ตั้งรหัสผ่านใหม่ - ระบบขอเอกสารออนไลน์ / Reset your password';
  const text = [
    `เรียน ${user.full_name}`,
    '',
    'มีการขอตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณในระบบขอเอกสารออนไลน์',
    `รหัสนักศึกษา (ใช้เข้าสู่ระบบ): ${user.student_id}`,
    '',
    `คลิกลิงก์นี้เพื่อตั้งรหัสผ่านใหม่ (ใช้ได้ภายใน ${RESET_TOKEN_TTL_MIN} นาที และใช้ได้ครั้งเดียว):`,
    link,
    '',
    'ถ้าคุณไม่ได้ขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ',
    '',
    '---',
    'A password reset was requested for your Document Request System account.',
    `Student ID (login): ${user.student_id}`,
    `Open this link within ${RESET_TOKEN_TTL_MIN} minutes to set a new password: ${link}`,
    'If you did not request this, you can ignore this email.',
  ].join('\n');
  const safeLink = escapeHtml(link);
  const html = `
    <div style="font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:560px">
      <p>เรียน ${escapeHtml(user.full_name)}</p>
      <p>มีการขอตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณใน<strong>ระบบขอเอกสารออนไลน์</strong><br>
         รหัสนักศึกษา (ใช้เข้าสู่ระบบ): <strong>${escapeHtml(user.student_id)}</strong></p>
      <p><a href="${safeLink}" style="display:inline-block;background:#0d6efd;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">ตั้งรหัสผ่านใหม่ / Reset password</a></p>
      <p style="font-size:13px;color:#555">ลิงก์ใช้ได้ภายใน ${RESET_TOKEN_TTL_MIN} นาที และใช้ได้ครั้งเดียว<br>
         ถ้ากดปุ่มไม่ได้ ให้คัดลอกลิงก์นี้ไปเปิดในเบราว์เซอร์:<br><span style="word-break:break-all">${safeLink}</span></p>
      <p style="font-size:13px;color:#555">ถ้าคุณไม่ได้ขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ<br>
         If you did not request this, you can ignore this email.</p>
    </div>`;
  return { subject, text, html };
}

module.exports = (pool) => {
  // ลงทะเบียน - อัปเดตให้รองรับฟิลด์ใหม่
  router.post('/register', async (req, res) => {
    try {
      const { student_id, password, full_name, email, phone, faculty, birth_date, id_number } = req.body;
      
      // ตรวจสอบข้อมูลที่จำเป็น
      if (!student_id || !password || !full_name || !email || !phone || !faculty) {
        return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
      }
      
      // ตรวจสอบรูปแบบวันเกิด
      if (birth_date && !isValidDate(birth_date)) {
        return res.status(400).json({ message: 'รูปแบบวันเดือนปีเกิดไม่ถูกต้อง' });
      }
      
      // ตรวจสอบรูปแบบหมายเลขบัตรประชาชน/Passport
      if (id_number && !isValidIdNumber(id_number)) {
        return res.status(400).json({ message: 'รูปแบบหมายเลขบัตรประชาชนหรือ Passport ไม่ถูกต้อง' });
      }
      
      // ตรวจสอบว่ามีผู้ใช้นี้อยู่แล้วหรือไม่
      const userCheck = await pool.query(
        'SELECT * FROM users WHERE student_id = $1 OR email = $2',
        [student_id, email]
      );
      
      if (userCheck.rows.length > 0) {
        return res.status(400).json({ message: 'รหัสนักศึกษาหรืออีเมลนี้มีอยู่ในระบบแล้ว' });
      }
      
      // ตรวจสอบหมายเลขบัตรประชาชน/Passport ซ้ำ (ถ้ามีการกรอก)
      if (id_number) {
        const idCheck = await pool.query(
          'SELECT * FROM users WHERE id_number = $1',
          [id_number]
        );
        
        if (idCheck.rows.length > 0) {
          return res.status(400).json({ message: 'หมายเลขบัตรประชาชนหรือ Passport นี้มีอยู่ในระบบแล้ว' });
        }
      }
      
      // เข้ารหัสรหัสผ่าน
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      // เพิ่มผู้ใช้ใหม่
      const newUser = await pool.query(
        'INSERT INTO users (student_id, password, full_name, email, phone, faculty, birth_date, id_number) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [student_id, hashedPassword, full_name, email, phone, faculty, birth_date || null, id_number || null]
      );
      
      res.status(201).json({ message: 'ลงทะเบียนสำเร็จ' });
    } catch (err) {
      console.error('Registration error:', err);
      res.status(500).json({ message: 'เกิดข้อผิดพลาดในการลงทะเบียน' });
    }
  });
  
  // เข้าสู่ระบบ
  router.post('/login', async (req, res) => {
    try {
      const { student_id, password } = req.body;
      
      const ip = clientIp(req);
      const accountKey = `acct:${ip}:${String(student_id || '').toLowerCase()}`;
      const ipKey = `ip:${ip}`;
      if (failureCount(accountKey) >= MAX_FAILS_PER_ACCOUNT_IP || failureCount(ipKey) >= MAX_FAILS_PER_IP) {
        return res.status(429).json({ message: 'เข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่' });
      }
      
      // ค้นหาผู้ใช้
      const user = await pool.query(
        'SELECT * FROM users WHERE student_id = $1',
        [student_id]
      );
      
      if (user.rows.length === 0) {
        recordFailure(accountKey);
        recordFailure(ipKey);
        return res.status(400).json({ message: 'รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง' });
      }
      
      // ตรวจสอบรหัสผ่าน
      const validPassword = await bcrypt.compare(password || '', user.rows[0].password);
      
      if (!validPassword) {
        recordFailure(accountKey);
        recordFailure(ipKey);
        return res.status(400).json({ message: 'รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง' });
      }
      
      loginFailures.delete(accountKey);
      
      // สร้าง token
      const token = jwt.sign(
        { id: user.rows[0].id, student_id: user.rows[0].student_id, role: user.rows[0].role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      res.status(200).json({
        token,
        user: {
          id: user.rows[0].id,
          student_id: user.rows[0].student_id,
          full_name: user.rows[0].full_name,
          email: user.rows[0].email,
          role: user.rows[0].role
        }
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
    }
  });
  
  // หน้า login ใช้ตัดสินใจว่าจะแสดงลิงก์ "ลืมรหัสผ่าน?" หรือไม่ (ยังไม่ตั้งค่าอีเมล = ซ่อน)
  router.get('/forgot-password/available', (req, res) => {
    res.json({ available: isMailConfigured() && !!process.env.APP_URL });
  });
  
  // ลืมรหัสผ่าน: ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลที่ลงทะเบียน
  // ตอบข้อความเดียวกันเสมอ ไม่บอกว่าอีเมลนี้มีในระบบหรือไม่ (กันการเช็กว่าอีเมลไหนสมัครไว้)
  router.post('/forgot-password', async (req, res) => {
    const genericMessage = 'ถ้าอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปแล้ว กรุณาตรวจสอบกล่องอีเมล (รวมถึงโฟลเดอร์สแปม)';
    try {
      const email = String(req.body.email || '').trim();
      if (!email || email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: 'กรุณากรอกอีเมลให้ถูกต้อง' });
      }
      
      // APP_URL ต้องตั้งไว้: ห้ามสร้างลิงก์จาก Host header (ปลอมได้ ทำให้ token รั่วไปเว็บอื่น)
      const appUrl = (process.env.APP_URL || '').replace(/\/+$/, '');
      if (!isMailConfigured() || !appUrl) {
        console.error('Forgot password: mail or APP_URL is not configured');
        return res.status(503).json({ message: 'ระบบส่งอีเมลยังไม่พร้อมใช้งาน กรุณาติดต่อเจ้าหน้าที่' });
      }
      
      const ip = clientIp(req);
      if (hitResetLimit(`ip:${ip}`, MAX_RESET_REQUESTS_PER_IP) ||
          hitResetLimit(`email:${email.toLowerCase()}`, MAX_RESET_REQUESTS_PER_EMAIL)) {
        return res.status(429).json({ message: 'ขอลิงก์บ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่' });
      }
      
      const users = await pool.query(
        'SELECT id, student_id, full_name, email FROM users WHERE LOWER(email) = LOWER($1)',
        [email]
      );
      
      for (const user of users.rows) {
        const token = crypto.randomBytes(32).toString('hex');
        // ลิงก์เก่าที่ยังไม่ได้ใช้ของผู้ใช้นี้ถือว่ายกเลิก
        await pool.query('DELETE FROM password_resets WHERE user_id = $1 AND used_at IS NULL', [user.id]);
        await pool.query(
          `INSERT INTO password_resets (user_id, token_hash, expires_at, request_ip)
           VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval, $4)`,
          [user.id, hashToken(token), String(RESET_TOKEN_TTL_MIN), ip.slice(0, 64)]
        );
        
        const link = `${appUrl}/reset-password.html?token=${token}`;
        // ส่งแบบไม่รอ: เวลาตอบกลับจะใกล้เคียงกันไม่ว่าอีเมลจะมีในระบบหรือไม่
        sendMail({ to: user.email, ...buildResetEmail(user, link) })
          .then(() => console.log(`Password reset email sent to user ${user.id}`))
          .catch(err => console.error(`Password reset email failed for user ${user.id}:`, err.message));
      }
      
      res.status(200).json({ message: genericMessage });
    } catch (err) {
      console.error('Forgot password error:', err);
      res.status(500).json({ message: 'เกิดข้อผิดพลาด กรุณาลองใหม่ภายหลัง' });
    }
  });
  
  // ตรวจลิงก์ก่อนแสดงฟอร์ม: คืนรหัสนักศึกษาให้ผู้ใช้รู้ว่าจะใช้อะไร login
  router.post('/reset-password/check', async (req, res) => {
    try {
      const token = String(req.body.token || '');
      if (!/^[0-9a-f]{64}$/.test(token)) {
        return res.status(400).json({ valid: false, message: 'ลิงก์ไม่ถูกต้อง' });
      }
      const result = await pool.query(
        `SELECT u.student_id FROM password_resets pr JOIN users u ON u.id = pr.user_id
         WHERE pr.token_hash = $1 AND pr.used_at IS NULL AND pr.expires_at > NOW()`,
        [hashToken(token)]
      );
      if (result.rows.length === 0) {
        return res.status(400).json({ valid: false, message: 'ลิงก์หมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่' });
      }
      res.json({ valid: true, student_id: result.rows[0].student_id });
    } catch (err) {
      console.error('Reset check error:', err);
      res.status(500).json({ valid: false, message: 'เกิดข้อผิดพลาด กรุณาลองใหม่ภายหลัง' });
    }
  });
  
  // ตั้งรหัสผ่านใหม่ด้วย token จากอีเมล (ใช้ได้ครั้งเดียว)
  router.post('/reset-password', async (req, res) => {
    const client = await pool.connect();
    try {
      const token = String(req.body.token || '');
      const password = String(req.body.password || '');
      if (!/^[0-9a-f]{64}$/.test(token)) {
        return res.status(400).json({ message: 'ลิงก์ไม่ถูกต้อง' });
      }
      if (password.length < 6 || password.length > 100) {
        return res.status(400).json({ message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });
      }
      
      await client.query('BEGIN');
      // FOR UPDATE: กันการใช้ลิงก์เดียวกันพร้อมกันสองครั้ง
      const result = await client.query(
        `SELECT pr.id, pr.user_id, u.student_id FROM password_resets pr JOIN users u ON u.id = pr.user_id
         WHERE pr.token_hash = $1 AND pr.used_at IS NULL AND pr.expires_at > NOW()
         FOR UPDATE OF pr`,
        [hashToken(token)]
      );
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'ลิงก์หมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่' });
      }
      const { id: resetId, user_id: userId, student_id: studentId } = result.rows[0];
      
      const hashedPassword = await bcrypt.hash(password, 10);
      await client.query('UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hashedPassword, userId]);
      await client.query('UPDATE password_resets SET used_at = NOW() WHERE id = $1', [resetId]);
      await client.query('DELETE FROM password_resets WHERE user_id = $1 AND used_at IS NULL', [userId]);
      await client.query('COMMIT');
      
      // ปลดล็อกการ login ผิดของบัญชีนี้
      for (const key of loginFailures.keys()) {
        if (key.startsWith('acct:') && key.endsWith(`:${String(studentId).toLowerCase()}`)) loginFailures.delete(key);
      }
      
      console.log(`Password reset via email link for user ${userId}`);
      res.json({ message: 'ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่', student_id: studentId });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('Reset password error:', err);
      res.status(500).json({ message: 'เกิดข้อผิดพลาด กรุณาลองใหม่ภายหลัง' });
    } finally {
      client.release();
    }
  });
  
  // ดึงข้อมูลผู้ใช้ปัจจุบัน - อัปเดตให้รวมฟิลด์ใหม่
  router.get('/user', async (req, res) => {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const user = await pool.query(
        'SELECT id, student_id, full_name, email, phone, faculty, birth_date, id_number, role, created_at FROM users WHERE id = $1',
        [decoded.id]
      );
      
      if (user.rows.length === 0) {
        return res.status(404).json({ message: 'ไม่พบผู้ใช้' });
      }
      
      res.status(200).json(user.rows[0]);
    } catch (err) {
      console.error('Get user error:', err);
      res.status(401).json({ message: 'ไม่มีการยืนยันตัวตน' });
    }
  });
  
  return router;
};

// ฟังก์ชันตรวจสอบรูปแบบวันที่
function isValidDate(dateString) {
  if (!dateString) return true; // อนุญาตให้เป็นค่าว่าง
  
  const date = new Date(dateString);
  const today = new Date();
  
  // ตรวจสอบว่าเป็นวันที่ที่ถูกต้อง
  if (isNaN(date.getTime())) {
    return false;
  }
  
  // ตรวจสอบว่าไม่เป็นวันที่ในอนาคต
  if (date > today) {
    return false;
  }
  
  // ตรวจสอบว่าไม่เก่าเกินไป (100 ปี)
  const hundredYearsAgo = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());
  if (date < hundredYearsAgo) {
    return false;
  }
  
  return true;
}

// ฟังก์ชันตรวจสอบรูปแบบหมายเลขบัตรประชาชน/Passport
function isValidIdNumber(idNumber) {
  if (!idNumber) return true; // อนุญาตให้เป็นค่าว่าง
  
  const trimmedId = idNumber.trim();
  
  // ตรวจสอบบัตรประชาชน (13 หลัก)
  if (/^[0-9]{13}$/.test(trimmedId)) {
    return true;
  }
  
  // ตรวจสอบ Passport (6-12 ตัวอักษรและตัวเลข)
  if (/^[A-Za-z0-9]{6,12}$/.test(trimmedId)) {
    return true;
  }
  
  return false;
}
