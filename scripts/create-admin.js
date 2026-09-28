// สร้างหรืออัปเดตบัญชีผู้ดูแลระบบ (ใช้ตอนติดตั้งระบบใหม่ หรือกู้รหัสผ่าน admin)
// Usage: node scripts/create-admin.js <username> <password> "<full name>" <email> [phone]
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcrypt');
const pool = require('../database/connection');

async function main() {
  const [username, password, fullName, email, phone = '-'] = process.argv.slice(2);

  if (!username || !password || !fullName || !email) {
    console.error('Usage: node scripts/create-admin.js <username> <password> "<full name>" <email> [phone]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters');
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // ใช้ username เป็น student_id เพราะระบบ login ด้วยคอลัมน์นี้
  const result = await pool.query(
    `INSERT INTO users (student_id, password, full_name, email, phone, faculty, role)
     VALUES ($1, $2, $3, $4, $5, 'Admin', 'admin')
     ON CONFLICT (student_id) DO UPDATE SET
       password = EXCLUDED.password,
       full_name = EXCLUDED.full_name,
       email = EXCLUDED.email,
       role = 'admin'
     RETURNING id, (xmax = 0) AS inserted`,
    [username, hashedPassword, fullName, email, phone]
  );

  const { id, inserted } = result.rows[0];
  console.log(`${inserted ? 'Created' : 'Updated'} admin "${username}" (id ${id})`);
}

main()
  .catch((err) => {
    console.error('Failed to create admin:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
