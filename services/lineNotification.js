const line = require('@line/bot-sdk');
require('dotenv').config();

// LINE Configuration
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

// สร้าง client เมื่อใช้งานจริง: line.Client จะ throw ถ้าไม่มี token ทำให้ server start ไม่ขึ้น
let lineClient = null;
const client = {
  pushMessage: (...args) => {
    if (!lineClient) lineClient = new line.Client(config);
    return lineClient.pushMessage(...args);
  }
};

// ฟังก์ชันหา Target ID สำหรับส่งข้อความ
function getNotificationTargets() {
  const targets = [];
  
  // ลำดับความสำคัญ: Group > Multiple Users > Single Admin
  if (process.env.LINE_GROUP_ID) {
    targets.push({
      type: 'group',
      id: process.env.LINE_GROUP_ID,
      name: 'LINE Group'
    });
  } else if (process.env.LINE_NOTIFY_USERS) {
    const userIds = process.env.LINE_NOTIFY_USERS.split(',').map(id => id.trim());
    userIds.forEach((userId, index) => {
      targets.push({
        type: 'user',
        id: userId,
        name: `Admin ${index + 1}`
      });
    });
  } else if (process.env.LINE_ADMIN_USER_ID) {
    targets.push({
      type: 'user',
      id: process.env.LINE_ADMIN_USER_ID,
      name: 'Admin'
    });
  }
  
  return targets;
}

// ฟังก์ชันส่งการแจ้งเตือนคำขอเอกสารใหม่
async function notifyNewDocumentRequest(requestData) {
  try {
    // ตรวจสอบว่ามี LINE configuration หรือไม่
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      console.log('LINE Channel Access Token not configured - skipping notification');
      return { success: false, message: 'LINE not configured' };
    }

    const targets = getNotificationTargets();
    
    if (targets.length === 0) {
      console.log('No LINE notification targets configured - skipping notification');
      return { success: false, message: 'No targets configured' };
    }
    
    // สร้างข้อความแจ้งเตือน
    const message = createNewRequestMessage(requestData);
    
    const results = [];
    
    // ส่งข้อความไปยัง targets ทั้งหมด
    for (const target of targets) {
      try {
        await client.pushMessage(target.id, message);
        console.log(`✅ LINE notification sent to ${target.name} (${target.type}): ${target.id}`);
        results.push({ target: target.name, success: true });
      } catch (error) {
        console.error(`❌ Failed to send to ${target.name}:`, error.message);
        results.push({ target: target.name, success: false, error: error.message });
      }
    }
    
    // ตรวจสอบผลลัพธ์
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    console.log(`LINE notification summary: ${successCount}/${totalCount} sent successfully for request ID: ${requestData.requestId}`);
    
    return {
      success: successCount > 0,
      message: `Sent to ${successCount}/${totalCount} targets`,
      details: results
    };
    
  } catch (error) {
    console.error('Error sending LINE notification:', error);
    return { success: false, message: error.message };
  }
}

// สร้างข้อความแจ้งเตือนคำขอใหม่ (ปรับปรุงสำหรับ Group)
function createNewRequestMessage(requestData) {
  const {
    requestId,
    studentId,
    studentName,
    documentName,
    deliveryMethod,
    urgent,
    totalPrice,
    timestamp
  } = requestData;

  // แปลงวิธีการรับเอกสาร
  const deliveryText = deliveryMethod === 'pickup' ? 'รับด้วยตนเอง' : 'รับทางไปรษณีย์';
  
  // เพิ่มข้อความเร่งด่วน (ถ้ามี)
  const urgentText = urgent ? ' 🔥 (เร่งด่วน)' : '';
  
  // Emoji สำหรับ Group
  const alertEmoji = urgent ? '🚨' : '🔔';
  
  // สร้างข้อความสำหรับ Group (อาจจะยาวกว่าเล็กน้อย)
  const messageText = `${alertEmoji} คำขอเอกสารใหม่${urgentText}

━━━━━━━━━━━━━━━━
📄 รหัสคำขอ: #${requestId}
👤 นักศึกษา: ${studentName}
🎓 รหัสนักศึกษา: ${studentId}
📋 ประเภทเอกสาร: ${documentName}
📦 วิธีการรับ: ${deliveryText}
💰 ยอดรวม: ${totalPrice} บาท
⏰ เวลา: ${formatThaiDateTime(timestamp)}
━━━━━━━━━━━━━━━━━

🔗 กรุณาเข้าระบบเพื่อดำเนินการ`;

  return {
    type: 'text',
    text: messageText
  };
}

// ฟังก์ชันแปลงวันที่เป็นรูปแบบไทย
function formatThaiDateTime(dateString) {
  const date = new Date(dateString);
  
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok'
  };
  
  return date.toLocaleDateString('th-TH', options);
}

// ฟังก์ชันทดสอบการส่งข้อความ
async function testLineNotification() {
  try {
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      return { success: false, message: 'LINE Channel Access Token not configured' };
    }

    const targets = getNotificationTargets();
    
    if (targets.length === 0) {
      return { success: false, message: 'No notification targets configured' };
    }

    const testMessage = {
      type: 'text',
      text: `🧪 ทดสอบระบบแจ้งเตือน LINE\n\n✅ ระบบทำงานปกติ\n⏰ เวลา: ${formatThaiDateTime(new Date())}\n\n📊 กำลังส่งไปยัง: ${targets.map(t => t.name).join(', ')}`
    };

    const results = [];
    
    for (const target of targets) {
      try {
        await client.pushMessage(target.id, testMessage);
        results.push({ target: target.name, success: true });
      } catch (error) {
        results.push({ target: target.name, success: false, error: error.message });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    return { 
      success: successCount > 0, 
      message: `Test sent to ${successCount}/${totalCount} targets`,
      details: results,
      targets: targets.map(t => ({ name: t.name, type: t.type }))
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// ฟังก์ชันดูการตั้งค่าปัจจุบัน
function getLineConfiguration() {
  const hasToken = !!process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const targets = getNotificationTargets();
  
  return {
    configured: hasToken && targets.length > 0,
    hasAccessToken: hasToken,
    targetCount: targets.length,
    targets: targets.map(t => ({
      type: t.type,
      name: t.name,
      id: t.type === 'group' ? t.id : t.id.substring(0, 10) + '...'
    })),
    mode: targets.length === 0 ? 'none' : 
          targets[0].type === 'group' ? 'group' : 
          targets.length > 1 ? 'multiple' : 'single'
  };
}

module.exports = {
  notifyNewDocumentRequest,
  testLineNotification,
  getLineConfiguration
};
