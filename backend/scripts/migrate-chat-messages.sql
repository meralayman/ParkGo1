-- ParkGo chat persistence + cancellation timestamp (run: psql -U postgres -d parkgo_db -f backend/scripts/migrate-chat-messages.sql)

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- chat_messages.user_id type must match users.id (UUID or INTEGER) — created at runtime by server ensureChatMessagesTable()
