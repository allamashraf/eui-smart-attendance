-- EUI Smart Attendance: development demo only. All seeded records are synthetic.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar(80) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name varchar(160) NOT NULL,
  role varchar(12) NOT NULL CHECK (role IN ('student','instructor','admin')),
  student_number varchar(32) UNIQUE,
  demo boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(32) NOT NULL,
  title varchar(160) NOT NULL,
  term varchar(80) NOT NULL,
  room varchar(100) NOT NULL DEFAULT '',
  instructor_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(code,term)
);
CREATE TABLE IF NOT EXISTS enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status varchar(16) NOT NULL DEFAULT 'active' CHECK(status IN ('active','withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subject_id,student_id)
);
CREATE TABLE IF NOT EXISTS class_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title varchar(120) NOT NULL,
  room varchar(100) NOT NULL DEFAULT '',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  state varchar(16) NOT NULL DEFAULT 'active' CHECK (state IN ('active','ended')),
  ontime_minutes int NOT NULL DEFAULT 15 CHECK (ontime_minutes BETWEEN 1 AND 120),
  cutoff_minutes int NOT NULL DEFAULT 90 CHECK (cutoff_minutes BETWEEN 5 AND 300),
  location_required boolean NOT NULL DEFAULT false, -- unused since Phase 1: a check-in without location goes to review
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Phase 1 (also added to existing databases by db/migrations/002_phase1.sql)
  anchor_lat double precision CHECK (anchor_lat BETWEEN -90 AND 90),
  anchor_lon double precision CHECK (anchor_lon BETWEEN -180 AND 180),
  anchor_accuracy_m numeric(9,2) CHECK (anchor_accuracy_m >= 0),
  anchor_set_at timestamptz,
  qr_open boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS attendance_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  slot bigint NOT NULL,
  token_hash char(64) NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  UNIQUE(session_id,slot)
);
CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES users(id),
  session_id uuid NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  status varchar(16) NOT NULL CHECK (status IN ('present','late','manual')),
  method varchar(16) NOT NULL CHECK (method IN ('qr','manual')),
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  device_hash char(64),
  location_result varchar(24) NOT NULL DEFAULT 'not_collected', -- Phase 1: inside | uncertain | no_location | no_anchor
  accuracy_m numeric(9,2), -- the student's reported accuracy (± metres); raw coordinates are never stored
  added_by uuid REFERENCES users(id),
  manual_reason text,
  -- Phase 1 (also added to existing databases by db/migrations/002_phase1.sql)
  verification varchar(16) NOT NULL DEFAULT 'needs_review' CHECK (verification IN ('verified','needs_review','manual')),
  distance_m numeric(10,1) CHECK (distance_m >= 0),
  UNIQUE(student_id,session_id)
);
CREATE TABLE IF NOT EXISTS security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  session_id uuid REFERENCES class_sessions(id) ON DELETE SET NULL,
  type varchar(70) NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS risk_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  student_id uuid REFERENCES users(id) ON DELETE SET NULL,
  rule_key varchar(48) NOT NULL,
  score int NOT NULL CHECK(score BETWEEN 0 AND 100),
  explanation text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  state varchar(16) NOT NULL DEFAULT 'open' CHECK (state IN ('open','resolved')),
  demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id,rule_key)
);
CREATE TABLE IF NOT EXISTS risk_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES risk_alerts(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES users(id),
  outcome varchar(24) NOT NULL CHECK (outcome IN ('legitimate','confirmed','inconclusive')),
  notes text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS correction_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES users(id),
  session_id uuid NOT NULL REFERENCES class_sessions(id),
  reason text NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewer_id uuid REFERENCES users(id),
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id,session_id)
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action varchar(80) NOT NULL,
  target_type varchar(50) NOT NULL,
  target_id uuid,
  reason text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enroll_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_subject ON class_sessions(subject_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_records_student ON attendance_records(student_id, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_records_session ON attendance_records(session_id, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenges_session ON attendance_challenges(session_id, slot DESC);
CREATE INDEX IF NOT EXISTS idx_security_session ON security_events(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_state ON risk_alerts(state, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_correction_state ON correction_requests(status, created_at DESC);
