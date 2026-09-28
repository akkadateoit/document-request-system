require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { Pool } = require('pg');

// สร้าง Express app
const app = express();
const PORT = process.env.PORT || 3200;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// เชื่อมต่อกับฐานข้อมูล
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

// ตั้งค่า multer สำหรับอัปโหลดไฟล์
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'public/uploads'));
  },
  filename: function (req, file, cb) {
    // ไม่ใช้ชื่อไฟล์เดิม: ชื่อภาษาไทยยาวๆ เกิน 255 bytes ทำให้บันทึกไม่ได้ (ENAMETOOLONG)
    // เก็บเฉพาะนามสกุลไว้ เพราะหน้าเว็บใช้แยกรูปภาพกับ PDF
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 10);
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  }
});
const upload = multer({ storage: storage });

// นำเข้าเส้นทาง (routes)
const authRoutes = require('./routes/auth')(pool);
const documentRoutes = require('./routes/documents')(pool, upload);

// ตรวจสอบว่ามีไฟล์ admin routes หรือไม่
let adminRoutes;
try {
  adminRoutes = require('./routes/admin')(pool);
} catch (error) {
  console.log('Admin routes not found, skipping...');
  adminRoutes = null;
}

// ตรวจสอบว่ามีไฟล์ reports routes หรือไม่
let reportRoutes;
try {
  reportRoutes = require('./routes/reports')(pool);
} catch (error) {
  console.log('Report routes not found, skipping...');
  reportRoutes = null;
}

// ตรวจสอบว่ามี LINE notification service หรือไม่
let testLineNotification, getLineConfiguration;
try {
  const lineServices = require('./services/lineNotification');
  testLineNotification = lineServices.testLineNotification;
  getLineConfiguration = lineServices.getLineConfiguration;
  console.log('✅ LINE notification service loaded');
} catch (error) {
  console.log('⚠️ LINE notification service not found, some features will be disabled');
  testLineNotification = null;
  getLineConfiguration = null;
}

// ใช้งานเส้นทาง
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);

if (adminRoutes) {
  app.use('/api/admin', adminRoutes);
}

if (reportRoutes) {
  app.use('/api/reports', reportRoutes);
}

// เพิ่ม endpoint สำหรับทดสอบ LINE notification (ถ้ามี)
if (testLineNotification && getLineConfiguration) {
  app.get('/api/test-line', async (req, res) => {
    try {
      console.log('🧪 Testing LINE notification...');
      
      const config = getLineConfiguration();
      console.log('LINE Configuration:', config);
      
      if (!config.configured) {
        return res.status(400).json({
          success: false,
          message: 'LINE notification not properly configured',
          config: config
        });
      }
      
      const result = await testLineNotification();
      
      res.json({
        success: result.success,
        message: result.message,
        config: config,
        details: result.details || null
      });
    } catch (error) {
      console.error('Error testing LINE notification:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });

  // เพิ่ม endpoint สำหรับดูการตั้งค่า LINE
  app.get('/api/line-config', (req, res) => {
    try {
      const config = getLineConfiguration();
      res.json(config);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });
} else {
  // ถ้าไม่มี LINE service ให้แสดงข้อความแจ้งเตือน
  app.get('/api/test-line', (req, res) => {
    res.status(503).json({
      success: false,
      message: 'LINE notification service not available. Please check if @line/bot-sdk is installed and lineNotification.js exists.'
    });
  });

  app.get('/api/line-config', (req, res) => {
    res.status(503).json({
      success: false,
      message: 'LINE notification service not available.'
    });
  });
}

// เส้นทางหลัก
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({ message: 'Internal Server Error' });
});

// เริ่มเซิร์ฟเวอร์
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🌐 Access URL: http://localhost:${PORT}`);
  
  if (testLineNotification && getLineConfiguration) {
    console.log(`🔗 Test LINE notification: http://localhost:${PORT}/api/test-line`);
    console.log(`⚙️ Check LINE config: http://localhost:${PORT}/api/line-config`);
  } else {
    console.log(`ℹ️ LINE notification not available - install @line/bot-sdk to enable`);
  }
  
  console.log('────────────────────────────────────────────────');
});
