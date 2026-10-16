-- Phase 1: room location, QR open/closed, and location verification on each record.
-- Safe to run any number of times: every statement checks first or changes nothing on a second run.
-- db/schema.sql is the baseline (there is no 001 file) and already contains these columns for fresh installs.
BEGIN;

-- The instructor's room position (the "anchor"). Storing it is fine; it is a room, not a student.
ALTER TABLE class_sessions
  ADD COLUMN IF NOT EXISTS anchor_lat double precision CHECK (anchor_lat BETWEEN -90 AND 90),
  ADD COLUMN IF NOT EXISTS anchor_lon double precision CHECK (anchor_lon BETWEEN -180 AND 180),
  ADD COLUMN IF NOT EXISTS anchor_accuracy_m numeric(9,2) CHECK (anchor_accuracy_m >= 0),
  ADD COLUMN IF NOT EXISTS anchor_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS qr_open boolean NOT NULL DEFAULT true;

-- Privacy: a record keeps the distance, the student's accuracy (accuracy_m) and the decision
-- (location_result), never the student's coordinates.
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS verification varchar(16) CHECK (verification IN ('verified','needs_review','manual')),
  ADD COLUMN IF NOT EXISTS distance_m numeric(10,1) CHECK (distance_m >= 0);

-- Records made before Phase 1 were never location-checked, so they need review; manual ones stay manual.
UPDATE attendance_records
  SET verification = CASE WHEN method = 'manual' THEN 'manual' ELSE 'needs_review' END
  WHERE verification IS NULL;
ALTER TABLE attendance_records ALTER COLUMN verification SET DEFAULT 'needs_review';
ALTER TABLE attendance_records ALTER COLUMN verification SET NOT NULL;

-- The live board polls every 2 seconds and filters by session; no existing index starts with session_id.
CREATE INDEX IF NOT EXISTS idx_records_session ON attendance_records(session_id, checked_in_at DESC);

COMMIT;
