const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sqlTypeForPgId(dataType) {
  if (dataType === "uuid") return "UUID";
  if (dataType === "integer" || dataType === "bigint" || dataType === "smallint") return "INTEGER";
  return null;
}

async function readPublicColumnType(pool, tableName, columnName) {
  const r = await pool.query(
    `
      SELECT data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
    `,
    [tableName, columnName]
  );
  return r.rows[0]?.data_type ?? null;
}

/**
 * @param {import("pg").Pool} pool
 */
async function ensureChatMessagesTable(pool) {
  const usersIdType = await readPublicColumnType(pool, "users", "id");
  const userIdSql = sqlTypeForPgId(usersIdType);
  if (!userIdSql) {
    console.warn("[ParkGo] chat_messages skipped: users.id not found.");
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      user_id ${userIdSql} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sender_type VARCHAR(10) NOT NULL CHECK (sender_type IN ('user', 'bot', 'admin')),
      content TEXT NOT NULL,
      reservation_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    GRANT ALL ON TABLE chat_messages TO parkgo_user
  `).catch(() => {});

  await pool.query(`
    GRANT USAGE, SELECT ON SEQUENCE chat_messages_id_seq TO parkgo_user
  `).catch(() => {});

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created
    ON chat_messages (user_id, created_at ASC)
  `);

  await pool.query(`
    ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ
  `);
}

function rowToMessage(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    userId: row.user_id != null ? String(row.user_id) : null,
    senderType: String(row.sender_type),
    content: String(row.content),
    reservationId: row.reservation_id != null ? String(row.reservation_id) : null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

/**
 * @param {import("pg").Pool} pool
 * @param {string} userId
 * @param {number} [limit]
 */
async function listChatMessages(pool, userId, limit = 200) {
  const cap = Math.min(500, Math.max(1, Number(limit) || 200));
  const r = await pool.query(
    `SELECT id, user_id, sender_type, content, reservation_id, created_at
     FROM chat_messages
     WHERE user_id = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [userId, cap]
  );
  return r.rows.map(rowToMessage);
}

/**
 * @param {import("pg").Pool} pool
 */
async function insertChatMessage(pool, { userId, senderType, content, reservationId = null }) {
  const text = String(content || "").trim();
  if (!text) return null;
  const st = String(senderType || "").toLowerCase();
  if (!["user", "bot", "admin"].includes(st)) {
    throw new Error("Invalid sender type");
  }
  const r = await pool.query(
    `INSERT INTO chat_messages (user_id, sender_type, content, reservation_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, sender_type, content, reservation_id, created_at`,
    [userId, st, text.slice(0, 8000), reservationId ? String(reservationId) : null]
  );
  return rowToMessage(r.rows[0]);
}

module.exports = {
  ensureChatMessagesTable,
  listChatMessages,
  insertChatMessage,
  UUID_RE,
};
