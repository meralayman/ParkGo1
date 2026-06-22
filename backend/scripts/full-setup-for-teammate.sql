-- =============================================================================
-- ParkGo — FULL DATABASE SETUP (for new teammates)
-- =============================================================================
-- Run these steps IN ORDER.
--
-- STEP 1: Create user & database (run as PostgreSQL superuser, e.g. postgres)
--   psql -U postgres -f backend/scripts/full-setup-for-teammate.sql
--
-- OR: open pgAdmin → connect as postgres → Query Tool → paste & run.
-- =============================================================================

-- =====================
-- STEP 1: Create user & database
-- =====================
CREATE USER parkgo_user WITH PASSWORD 'Parkgo123';
CREATE DATABASE parkgo_db OWNER parkgo_user;

-- If parkgo_user already existed with wrong password:
-- ALTER USER parkgo_user WITH PASSWORD 'Parkgo123';

-- =====================
-- STEP 2: Connect to parkgo_db and run the rest
-- =====================
-- IMPORTANT: After running Step 1, reconnect to parkgo_db:
--   psql -U postgres -d parkgo_db
-- Then run everything below.
-- =====================

-- Grant schema permissions
GRANT USAGE ON SCHEMA public TO parkgo_user;
GRANT CREATE ON SCHEMA public TO parkgo_user;

-- =====================
-- TABLE: users
-- =====================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(50),
  national_id VARCHAR(50),
  username VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

GRANT ALL ON TABLE users TO parkgo_user;
GRANT USAGE, SELECT ON SEQUENCE users_id_seq TO parkgo_user;

-- =====================
-- TABLE: parking_slots
-- =====================
CREATE TABLE IF NOT EXISTS parking_slots (
  slot_no VARCHAR(50) PRIMARY KEY,
  state INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
GRANT ALL ON TABLE parking_slots TO parkgo_user;

-- Insert default parking slots (A=90, B=45, C=28, D=16 = 179 slots total)
INSERT INTO parking_slots (slot_no, state) VALUES
  -- Zone A: 90 slots (A1–A90)
  ('A1', 0), ('A2', 0), ('A3', 0), ('A4', 0), ('A5', 0), ('A6', 0), ('A7', 0), ('A8', 0), ('A9', 0), ('A10', 0),
  ('A11', 0), ('A12', 0), ('A13', 0), ('A14', 0), ('A15', 0), ('A16', 0), ('A17', 0), ('A18', 0), ('A19', 0), ('A20', 0),
  ('A21', 0), ('A22', 0), ('A23', 0), ('A24', 0), ('A25', 0), ('A26', 0), ('A27', 0), ('A28', 0), ('A29', 0), ('A30', 0),
  ('A31', 0), ('A32', 0), ('A33', 0), ('A34', 0), ('A35', 0), ('A36', 0), ('A37', 0), ('A38', 0), ('A39', 0), ('A40', 0),
  ('A41', 0), ('A42', 0), ('A43', 0), ('A44', 0), ('A45', 0), ('A46', 0), ('A47', 0), ('A48', 0), ('A49', 0), ('A50', 0),
  ('A51', 0), ('A52', 0), ('A53', 0), ('A54', 0), ('A55', 0), ('A56', 0), ('A57', 0), ('A58', 0), ('A59', 0), ('A60', 0),
  ('A61', 0), ('A62', 0), ('A63', 0), ('A64', 0), ('A65', 0), ('A66', 0), ('A67', 0), ('A68', 0), ('A69', 0), ('A70', 0),
  ('A71', 0), ('A72', 0), ('A73', 0), ('A74', 0), ('A75', 0), ('A76', 0), ('A77', 0), ('A78', 0), ('A79', 0), ('A80', 0),
  ('A81', 0), ('A82', 0), ('A83', 0), ('A84', 0), ('A85', 0), ('A86', 0), ('A87', 0), ('A88', 0), ('A89', 0), ('A90', 0),
  -- Zone B: 45 slots (B1–B45)
  ('B1', 0), ('B2', 0), ('B3', 0), ('B4', 0), ('B5', 0), ('B6', 0), ('B7', 0), ('B8', 0), ('B9', 0), ('B10', 0),
  ('B11', 0), ('B12', 0), ('B13', 0), ('B14', 0), ('B15', 0), ('B16', 0), ('B17', 0), ('B18', 0), ('B19', 0), ('B20', 0),
  ('B21', 0), ('B22', 0), ('B23', 0), ('B24', 0), ('B25', 0), ('B26', 0), ('B27', 0), ('B28', 0), ('B29', 0), ('B30', 0),
  ('B31', 0), ('B32', 0), ('B33', 0), ('B34', 0), ('B35', 0), ('B36', 0), ('B37', 0), ('B38', 0), ('B39', 0), ('B40', 0),
  ('B41', 0), ('B42', 0), ('B43', 0), ('B44', 0), ('B45', 0),
  -- Zone C: 28 slots (C1–C28)
  ('C1', 0), ('C2', 0), ('C3', 0), ('C4', 0), ('C5', 0), ('C6', 0), ('C7', 0), ('C8', 0), ('C9', 0), ('C10', 0),
  ('C11', 0), ('C12', 0), ('C13', 0), ('C14', 0), ('C15', 0), ('C16', 0), ('C17', 0), ('C18', 0), ('C19', 0), ('C20', 0),
  ('C21', 0), ('C22', 0), ('C23', 0), ('C24', 0), ('C25', 0), ('C26', 0), ('C27', 0), ('C28', 0),
  -- Zone D: 16 slots (D1–D16)
  ('D1', 0), ('D2', 0), ('D3', 0), ('D4', 0), ('D5', 0), ('D6', 0), ('D7', 0), ('D8', 0), ('D9', 0), ('D10', 0),
  ('D11', 0), ('D12', 0), ('D13', 0), ('D14', 0), ('D15', 0), ('D16', 0)
ON CONFLICT (slot_no) DO NOTHING;

-- =====================
-- TABLE: reservations
-- =====================
CREATE TABLE IF NOT EXISTS reservations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  slot_no VARCHAR(50) NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
  payment_method VARCHAR(50),
  total_amount DECIMAL(10,2) DEFAULT 0,
  qr_token VARCHAR(255),
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_out_time TIMESTAMP WITH TIME ZONE,
  late_fee_applied BOOLEAN DEFAULT FALSE,
  late_fee_amount DECIMAL(12,2) DEFAULT 0,
  dynamic_hourly_rate DECIMAL(12,4),
  qr_expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT reservations_status_check
    CHECK (status IN ('confirmed', 'checked_in', 'closed', 'cancelled', 'no_show'))
);

GRANT ALL ON TABLE reservations TO parkgo_user;
GRANT USAGE, SELECT ON SEQUENCE reservations_id_seq TO parkgo_user;

-- =====================
-- TABLE: incident_reports
-- =====================
CREATE TABLE IF NOT EXISTS incident_reports (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  gatekeeper_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reservation_id INTEGER REFERENCES reservations(id),
  full_name VARCHAR(255) NOT NULL,
  mobile VARCHAR(50),
  email VARCHAR(255),
  description TEXT NOT NULL,
  photo_filename VARCHAR(500),
  reporter_type VARCHAR(20) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

GRANT ALL ON TABLE incident_reports TO parkgo_user;
GRANT USAGE, SELECT ON SEQUENCE incident_reports_id_seq TO parkgo_user;
ALTER TABLE incident_reports OWNER TO parkgo_user;

-- =====================
-- TABLE: logs (Audit Trail)
-- =====================
CREATE TABLE IF NOT EXISTS logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  action VARCHAR(500) NOT NULL,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs ("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs (user_id);

GRANT ALL ON TABLE logs TO parkgo_user;
GRANT USAGE, SELECT ON SEQUENCE logs_id_seq TO parkgo_user;

-- =====================
-- TABLE: security_alerts
-- =====================
CREATE TABLE IF NOT EXISTS security_alerts (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  alert_type VARCHAR(64) NOT NULL,
  message TEXT NOT NULL,
  details JSONB
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_created ON security_alerts(created_at DESC);

GRANT ALL ON TABLE security_alerts TO parkgo_user;
GRANT USAGE, SELECT ON SEQUENCE security_alerts_id_seq TO parkgo_user;

-- =====================
-- TABLE: refresh_tokens
-- =====================
-- NOTE: If users.id is UUID, change the user_id type below to UUID.
--       If users.id is INTEGER (SERIAL), use INTEGER instead.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(token_hash)
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

GRANT ALL ON TABLE refresh_tokens TO parkgo_user;
GRANT USAGE, SELECT ON SEQUENCE refresh_tokens_id_seq TO parkgo_user;

-- =====================
-- TABLE: chat_messages (created at runtime by the app, but here for completeness)
-- =====================
CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_type VARCHAR(10) NOT NULL CHECK (sender_type IN ('user', 'bot', 'admin')),
  content TEXT NOT NULL,
  reservation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created ON chat_messages (user_id, created_at ASC);

GRANT ALL ON TABLE chat_messages TO parkgo_user;
GRANT USAGE, SELECT ON SEQUENCE chat_messages_id_seq TO parkgo_user;

-- =============================================================================
-- DONE! All 8 tables + 179 parking slots created. Your teammate can now run the backend.
--
-- Quick setup instructions:
--   1. Install PostgreSQL
--   2. Run Step 1 (CREATE USER / CREATE DATABASE) as postgres superuser
--   3. Connect to parkgo_db and run Step 2+ (everything after)
--   4. Copy .env.example to .env (set DATABASE_URL=postgresql://parkgo_user:Parkgo123@localhost/parkgo_db)
--   5. cd backend && npm install && npm start
-- =============================================================================
