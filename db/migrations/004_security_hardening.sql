-- Authentication tables are the critical login dependency.
-- Commit them first so an unrelated duplicate live class session cannot break login.
-- This migration is idempotent and does not delete attendance or user records.
BEGIN;
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  key char(64) PRIMARY KEY,
  attempts integer NOT NULL CHECK(attempts>0),
  reset_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_reset ON auth_rate_limits(reset_at);
CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id,expires_at);
ALTER TABLE auth_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
COMMIT;

-- Protect one-active-session-per-class if the existing database permits it.
-- Never silently end or alter an existing class session.
-- If pre-existing duplicates exist, leave the old records untouched and warn.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM class_sessions
    WHERE state='active'
    GROUP BY subject_id HAVING COUNT(*)>1
  ) THEN
    RAISE NOTICE 'More than one active session exists for a class: the unique index was skipped. Close duplicates intentionally, then rerun this migration.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_session_per_subject
      ON class_sessions(subject_id) WHERE state='active';
  END IF;
END $$;
