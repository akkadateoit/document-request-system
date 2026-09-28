const express = require('express');
const router = express.Router();
const authenticateJWT = require('../middleware/auth');
const isAdmin = require('../middleware/admin');

module.exports = (pool) => {
  // รายงานสรุปรายการขอเอกสาร
  // ช่วงวันที่: รวมทั้งวันสุดท้าย (created_at < end_date + 1 วัน) — ถ้าใช้ BETWEEN จะตัดคำขอหลังเที่ยงคืนของวันสุดท้ายทิ้ง
  // รายได้: นับเฉพาะคำขอสถานะ completed
  router.get('/summary', authenticateJWT, isAdmin, async (req, res) => {
    try {
      const { start_date, end_date } = req.query;
      const range = [start_date || '1900-01-01', end_date || '2999-12-31'];
      const inRangeOf = (alias) => `${alias}created_at >= $1::date AND ${alias}created_at < ($2::date + 1)`;
      const inRange = inRangeOf('');
      
      // คำนวณจำนวนคำขอเอกสารทั้งหมด
      const totalRequests = await pool.query(
        `SELECT COUNT(*) FROM document_requests WHERE ${inRange}`,
        range
      );
      
      // จำนวนคำขอเอกสารแยกตามสถานะ
      const requestsByStatus = await pool.query(
        `SELECT status, COUNT(*) FROM document_requests WHERE ${inRange} GROUP BY status`,
        range
      );
      
      // จำนวนคำขอแยกตามประเภทเอกสาร — นับทุกเอกสารในคำขอ (document_request_items)
      // คำขอแบบเก่าที่ไม่มี items ใช้ document_type_id ของคำขอหลัก
      const requestsByType = await pool.query(
        `SELECT dt.name_th, COUNT(DISTINCT x.request_id) AS count
        FROM (
          SELECT dri.request_id, dri.document_type_id
          FROM document_request_items dri
          JOIN document_requests dr ON dr.id = dri.request_id
          WHERE ${inRangeOf('dr.')}
          UNION ALL
          SELECT dr.id, dr.document_type_id
          FROM document_requests dr
          WHERE ${inRangeOf('dr.')}
            AND NOT EXISTS (SELECT 1 FROM document_request_items i WHERE i.request_id = dr.id)
        ) x
        JOIN document_types dt ON dt.id = x.document_type_id
        GROUP BY dt.name_th
        ORDER BY count DESC`,
        range
      );
      
      // รายได้ (เฉพาะคำขอที่เสร็จสิ้น)
      const totalRevenue = await pool.query(
        `SELECT SUM(total_price) FROM document_requests WHERE ${inRange} AND status = 'completed'`,
        range
      );
      
      res.status(200).json({
        totalRequests: parseInt(totalRequests.rows[0].count),
        requestsByStatus: requestsByStatus.rows,
        requestsByType: requestsByType.rows,
        totalRevenue: parseFloat(totalRevenue.rows[0].sum || 0)
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายงาน' });
    }
  });
  
  // รายงานคำขอเอกสารรายเดือน
  router.get('/monthly', authenticateJWT, isAdmin, async (req, res) => {
    try {
      const { year } = req.query;
      const currentYear = year || new Date().getFullYear();
      
      const monthlyReport = await pool.query(
        `SELECT 
          TO_CHAR(created_at, 'MM') as month,
          COUNT(*) as request_count,
          COALESCE(SUM(total_price) FILTER (WHERE status = 'completed'), 0) as revenue -- รายได้เฉพาะคำขอที่เสร็จสิ้น
        FROM document_requests
        WHERE EXTRACT(YEAR FROM created_at) = $1
        GROUP BY month
        ORDER BY month`,
        [currentYear]
      );
      
      res.status(200).json(monthlyReport.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายงานรายเดือน' });
    }
  });
  
  return router;
};
