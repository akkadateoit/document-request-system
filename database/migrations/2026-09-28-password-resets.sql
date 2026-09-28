-- ลืมรหัสผ่าน: token สำหรับลิงก์รีเซ็ตรหัสผ่านที่ส่งทางอีเมล
-- เก็บเฉพาะ SHA-256 ของ token (token จริงอยู่ในลิงก์ในอีเมลเท่านั้น)
-- Run once on every existing server: psql -d <db> -v ON_ERROR_STOP=1 -f database/migrations/2026-09-28-password-resets.sql

CREATE TABLE IF NOT EXISTS password_resets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    request_ip VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);

COMMENT ON TABLE password_resets IS 'token รีเซ็ตรหัสผ่าน (ลืมรหัสผ่าน) — ใช้ได้ครั้งเดียว หมดอายุตาม expires_at';
COMMENT ON COLUMN password_resets.token_hash IS 'SHA-256 (hex) ของ token ในลิงก์ที่ส่งทางอีเมล';
