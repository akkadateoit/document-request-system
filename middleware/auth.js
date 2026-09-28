const jwt = require('jsonwebtoken');
require('dotenv').config();

const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        // 401 = ต้องเข้าสู่ระบบใหม่ (token หมดอายุ/ไม่ถูกต้อง) — main.js ใช้สถานะนี้พาไปหน้า login
        return res.status(401).json({ message: 'Token ไม่ถูกต้อง' });
      }
      
      req.user = user;
      next();
    });
  } else {
    res.status(401).json({ message: 'ไม่มีการยืนยันตัวตน' });
  }
};

module.exports = authenticateJWT;
