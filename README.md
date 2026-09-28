# ระบบขอเอกสารออนไลน์ (Document Request System)

ระบบให้นักศึกษาขอเอกสารทางการศึกษาออนไลน์ เช่น ใบแสดงผลการศึกษาและหนังสือรับรองต่างๆ นักศึกษาเลือกได้ว่าจะมารับเองหรือให้ส่งทางไปรษณีย์ โอนเงินแล้วแนบสลิป และติดตามสถานะได้ เจ้าหน้าที่จัดการคำขอ ผู้ใช้ และดูรายงานได้ และทุกครั้งที่มีคำขอใหม่ ระบบจะส่งข้อความแจ้งเข้า LINE Group

- ใช้งานจริงที่ https://document.northbkk.ac.th (มหาวิทยาลัยนอร์ทกรุงเทพ)
- รองรับ 3 ภาษา: ไทย, อังกฤษ และจีน
- Stack: Node.js + Express, PostgreSQL, JWT และหน้าเว็บ HTML/JS ธรรมดา + Bootstrap 5 (ไม่ต้อง build)

## ความต้องการของระบบ

| | เวอร์ชันที่ใช้บน production |
|---|---|
| Node.js | 22 |
| PostgreSQL | 17 |
| pm2 | สำหรับรัน process |
| nginx | reverse proxy + ส่งไฟล์ static |

## ติดตั้งบน server ใหม่

```bash
# 1. โค้ด
git clone git@github.com:akkadateoit/document-request-system.git /var/www/app/document-request-system
cd /var/www/app/document-request-system
npm ci

# 2. ค่าตั้งค่า
cp .env.example .env
nano .env                      # ใส่ค่า DB, JWT_SECRET (openssl rand -hex 32), LINE

# 3. ฐานข้อมูล
sudo -u postgres createuser -P document_request       # ตั้งรหัสผ่านให้ตรงกับ DB_PASSWORD
sudo -u postgres createdb -O document_request document_request_system
psql -h localhost -U document_request -d document_request_system -v ON_ERROR_STOP=1 -f database/schema.sql
psql -h localhost -U document_request -d document_request_system -v ON_ERROR_STOP=1 -f database/seed.sql

# 4. บัญชีผู้ดูแลระบบคนแรก (login ด้วย username นี้ในช่องรหัสนักศึกษา)
node scripts/create-admin.js admin 'รหัสผ่านอย่างน้อย8ตัว' "ผู้ดูแลระบบ" admin@example.ac.th

# 5. รันด้วย pm2
pm2 start ecosystem.config.js
pm2 save && pm2 startup

# 6. nginx + HTTPS
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/document   # แก้ domain และ path
sudo ln -s /etc/nginx/sites-available/document /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d document.example.ac.th
```

หมายเหตุ
- ไฟล์ `database/seed.sql` ใส่แค่รายชื่อคณะและประเภทเอกสารพร้อมราคา ไม่มีข้อมูลนักศึกษา ให้แก้ตามสถาบันก่อนหรือหลังโหลด
- สลิปที่นักศึกษาอัปโหลดจะเก็บใน `public/uploads/` ซึ่งไม่อยู่ใน git ถ้าย้ายจาก server เดิม ต้อง copy โฟลเดอร์นี้ไปเองพร้อม dump ของ DB
- ถ้าจะย้ายข้อมูลจาก server เดิม ให้ใช้ `pg_dump` / `pg_restore` ทั้ง DB แทนการรัน `schema.sql` + `seed.sql`
- LINE ไม่จำเป็นต้องตั้งค่า ถ้าไม่มี token ระบบจะข้ามการแจ้งเตือนไป ดูวิธีตั้งค่าใน `manuals/LINE_SETUP.md`

## อัปเดต server ที่ติดตั้งแล้ว

```bash
cd /var/www/app/document-request-system
git pull
npm ci                                    # เมื่อ package-lock.json เปลี่ยน
pm2 restart document-request-system       # เมื่อไฟล์ backend เปลี่ยน (หน้าเว็บใน public/ มีผลทันที)
```

ตอนนี้ยังไม่มีระบบ migration ถ้ามีการเปลี่ยนโครงสร้าง DB ต้องรัน SQL เองบนทุก server

## กติกาคิดราคา (ตามหน้าเว็บ)

- ราคาเอกสารแต่ละประเภทตั้งไว้ในตาราง `document_types.price`
- ส่งทางไปรษณีย์ บวก 200 บาทต่อคำขอ
- เร่งด่วน (ได้เฉพาะแบบมารับเอง) บวก 50 บาทต่อฉบับ
- ราคาคำนวณใน `public/js/request.js`

## ก่อนเปิดให้สถาบันอื่นใช้ (SaaS)

ตอนนี้ระบบรองรับ**สถาบันเดียวต่อ 1 การติดตั้ง** ค่าต่อไปนี้ยังฝังอยู่ในโค้ด ต้องแก้ก่อนติดตั้งให้สถาบันอื่น:

| ค่า | อยู่ที่ |
|---|---|
| ชื่อมหาวิทยาลัย โลโก้ | `public/*.html`, `public/img/logo.png`, `public/locales/*.json` |
| ข้อมูลบัญชีธนาคาร | `public/js/request.js` (ตัวแปร `BANK_*` ใน `.env` ยังไม่ถูกใช้) |
| ค่าส่ง 200 / เร่งด่วน 50 บาท | `public/js/request.js` |
| ข้อความ API และข้อความ LINE | เป็นภาษาไทยในโค้ด `routes/` และ `services/` |

เรื่องความปลอดภัยที่ควรแก้ก่อนขยายระบบ:
- ค่า `?lang=` ถูกนำไปต่อเป็นชื่อคอลัมน์ใน SQL ตรงๆ ควรจำกัดให้รับเฉพาะ `th`, `en`, `zh`
- `/api/test-line` และ `/api/line-config` ไม่ต้อง login
- server เชื่อราคาที่หน้าเว็บส่งมา ควรให้ server คำนวณซ้ำด้วยกติกาเดียวกัน
- admin รีเซ็ตรหัสผ่านผู้ใช้เป็น `123456` เสมอ
- ไฟล์สลิปใน `/uploads/` เปิดดูได้โดยไม่ต้อง login ถ้ารู้ชื่อไฟล์

## โครงสร้าง

```
server.js              จุดเริ่ม Express, ต่อ route เข้ากับ pool/multer
routes/                auth, documents (นักศึกษา), admin, reports
middleware/            ตรวจ JWT และสิทธิ์ admin
services/              LINE notification
database/              schema.sql, seed.sql
scripts/               create-admin.js
deploy/                ตัวอย่าง config nginx
public/                หน้าเว็บ (นักศึกษา) และ public/admin/ (ผู้ดูแล)
public/locales/        ไฟล์แปลภาษา th / en / zh
```

รายละเอียดสถาปัตยกรรมสำหรับนักพัฒนา อยู่ใน `CLAUDE.md`
