BEGIN;
CREATE TABLE IF NOT EXISTS auth_rate_limits (
 key char(64) PRIMARY KEY, attempts integer NOT NULL CHECK(attempts>0),
 reset_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_reset ON auth_rate_limits(reset_at);
CREATE TABLE IF NOT EXISTS auth_sessions(
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id,expires_at);
-- Close any duplicate existing active sessions before migrating.
CREATE UNIQUE INDEX IF NOT EXISTS one_active_session_per_subject ON class_sessions(subject_id) WHERE state='active';
ALTER TABLE auth_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
COMMIT;
