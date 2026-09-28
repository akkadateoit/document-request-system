-- สถานที่รับเอกสาร เมื่อเลือกรับด้วยตนเอง (delivery_method = 'pickup')
-- NULL = ไม่ได้ระบุ (คำขอก่อนมีฟีเจอร์นี้ หรือส่งทางไปรษณีย์)
-- Run once on every existing server: psql -d <db> -v ON_ERROR_STOP=1 -f database/migrations/2026-09-28-pickup-location.sql
-- New installs already get this column from database/schema.sql.

ALTER TABLE document_requests ADD COLUMN IF NOT EXISTS pickup_location VARCHAR(20);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_requests_pickup_location_check') THEN
    ALTER TABLE document_requests
      ADD CONSTRAINT document_requests_pickup_location_check
      CHECK (pickup_location IN ('saphanmai', 'rangsit'));
  END IF;
END $$;

COMMENT ON COLUMN document_requests.pickup_location IS 'สถานที่รับเอกสารด้วยตนเอง: saphanmai (สะพานใหม่), rangsit (รังสิต); NULL = ไม่ระบุ';
COMMENT ON COLUMN document_requests.delivery_method IS 'วิธีการรับเอกสาร: pickup (รับด้วยตนเอง ดูสถานที่ที่ pickup_location), mail (รับทางไปรษณีย์)';
