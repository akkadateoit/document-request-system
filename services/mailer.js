// ส่งอีเมล (ใช้กับลืมรหัสผ่าน) ผ่าน SMTP ที่ตั้งค่าใน .env
// มหาวิทยาลัยใช้ Google Workspace: SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_SECURE=true
// และ SMTP_PASS เป็น App Password ของบัญชีผู้ส่ง (ต้องเปิด 2-Step Verification)
// MAIL_TRANSPORT=log = ไม่ส่งจริง แค่พิมพ์อีเมลลง log (ใช้ตอนทดสอบ)
const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter = null;

function isLogMode() {
  return process.env.MAIL_TRANSPORT === 'log';
}

function isMailConfigured() {
  return isLogMode() || !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (transporter) return transporter;
  if (isLogMode()) {
    transporter = nodemailer.createTransport({ jsonTransport: true });
  } else {
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    // 465 = TLS ตั้งแต่ต้น (secure=true), 587 = STARTTLS (secure=false แล้วอัปเกรดเป็น TLS)
    // ถ้าไม่ได้ตั้ง SMTP_SECURE ให้เลือกตาม port
    const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      requireTLS: !secure, // บังคับ STARTTLS: ไม่ยอมส่งรหัสผ่านแบบไม่เข้ารหัส
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  if (!isMailConfigured()) {
    throw new Error('Mail is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS)');
  }
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const info = await getTransporter().sendMail({ from, to, subject, text, html });
  if (isLogMode()) {
    console.log('📧 [MAIL_TRANSPORT=log] email not sent:', info.message);
  }
  return info;
}

// ตรวจการเชื่อมต่อ/ล็อกอิน SMTP โดยไม่ส่งอีเมล (ใช้ตอนตั้งค่า: node -e "require('./services/mailer').verify()...")
async function verify() {
  if (!isMailConfigured()) throw new Error('Mail is not configured');
  return getTransporter().verify();
}

module.exports = { sendMail, isMailConfigured, verify };
