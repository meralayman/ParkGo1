-- =============================================================================
-- ParkGo — Fix parking slots: replace old numeric slots with zone-based slots
-- =============================================================================
-- Run this against parkgo_db if the server migration doesn't auto-fix:
--   psql -U parkgo_user -d parkgo_db -f backend/scripts/fix-slots.sql
-- OR paste into pgAdmin Query Tool connected to parkgo_db.
-- =============================================================================

-- Step 1: Fix reservations.slot_no if it is INTEGER
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='reservations' AND column_name='slot_no'
      AND data_type NOT IN ('character varying','text','character')
  ) THEN
    RAISE NOTICE 'Converting reservations.slot_no to VARCHAR(50)...';
    ALTER TABLE reservations ALTER COLUMN slot_no TYPE VARCHAR(50) USING slot_no::text;
  END IF;
END $$;

-- Step 2: Drop and recreate parking_slots with correct VARCHAR type + 179 zone slots
DROP TABLE IF EXISTS parking_slots CASCADE;

CREATE TABLE parking_slots (
  slot_no VARCHAR(50) PRIMARY KEY,
  state INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

GRANT ALL ON TABLE parking_slots TO parkgo_user;

INSERT INTO parking_slots (slot_no, state) VALUES
  -- Zone A: 90 slots
  ('A1',0),('A2',0),('A3',0),('A4',0),('A5',0),('A6',0),('A7',0),('A8',0),('A9',0),('A10',0),
  ('A11',0),('A12',0),('A13',0),('A14',0),('A15',0),('A16',0),('A17',0),('A18',0),('A19',0),('A20',0),
  ('A21',0),('A22',0),('A23',0),('A24',0),('A25',0),('A26',0),('A27',0),('A28',0),('A29',0),('A30',0),
  ('A31',0),('A32',0),('A33',0),('A34',0),('A35',0),('A36',0),('A37',0),('A38',0),('A39',0),('A40',0),
  ('A41',0),('A42',0),('A43',0),('A44',0),('A45',0),('A46',0),('A47',0),('A48',0),('A49',0),('A50',0),
  ('A51',0),('A52',0),('A53',0),('A54',0),('A55',0),('A56',0),('A57',0),('A58',0),('A59',0),('A60',0),
  ('A61',0),('A62',0),('A63',0),('A64',0),('A65',0),('A66',0),('A67',0),('A68',0),('A69',0),('A70',0),
  ('A71',0),('A72',0),('A73',0),('A74',0),('A75',0),('A76',0),('A77',0),('A78',0),('A79',0),('A80',0),
  ('A81',0),('A82',0),('A83',0),('A84',0),('A85',0),('A86',0),('A87',0),('A88',0),('A89',0),('A90',0),
  -- Zone B: 45 slots
  ('B1',0),('B2',0),('B3',0),('B4',0),('B5',0),('B6',0),('B7',0),('B8',0),('B9',0),('B10',0),
  ('B11',0),('B12',0),('B13',0),('B14',0),('B15',0),('B16',0),('B17',0),('B18',0),('B19',0),('B20',0),
  ('B21',0),('B22',0),('B23',0),('B24',0),('B25',0),('B26',0),('B27',0),('B28',0),('B29',0),('B30',0),
  ('B31',0),('B32',0),('B33',0),('B34',0),('B35',0),('B36',0),('B37',0),('B38',0),('B39',0),('B40',0),
  ('B41',0),('B42',0),('B43',0),('B44',0),('B45',0),
  -- Zone C: 28 slots
  ('C1',0),('C2',0),('C3',0),('C4',0),('C5',0),('C6',0),('C7',0),('C8',0),('C9',0),('C10',0),
  ('C11',0),('C12',0),('C13',0),('C14',0),('C15',0),('C16',0),('C17',0),('C18',0),('C19',0),('C20',0),
  ('C21',0),('C22',0),('C23',0),('C24',0),('C25',0),('C26',0),('C27',0),('C28',0),
  -- Zone D: 16 slots
  ('D1',0),('D2',0),('D3',0),('D4',0),('D5',0),('D6',0),('D7',0),('D8',0),('D9',0),('D10',0),
  ('D11',0),('D12',0),('D13',0),('D14',0),('D15',0),('D16',0);

-- Done: 179 slots (A1-A90, B1-B45, C1-C28, D1-D16)
SELECT COUNT(*) AS total_slots FROM parking_slots;
