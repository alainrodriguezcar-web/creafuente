const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS fonts (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        TEXT NOT NULL,
        format      TEXT NOT NULL CHECK (format IN ('otf','ttf')),
        glyph_count INTEGER NOT NULL DEFAULT 0,
        file_data   BYTEA NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS fonts_created_idx ON fonts (created_at DESC);
    `);
    console.log('[DB] Tablas inicializadas correctamente');
  } finally {
    client.release();
  }
}

async function saveFont({ name, format, glyphCount, fileData }) {
  const { rows } = await pool.query(
    `INSERT INTO fonts (name, format, glyph_count, file_data)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, format, glyph_count, created_at`,
    [name, format, glyphCount, fileData]
  );
  return rows[0];
}

async function getFont(id) {
  const { rows } = await pool.query(
    'SELECT * FROM fonts WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function listFonts(limit = 20) {
  const { rows } = await pool.query(
    'SELECT id, name, format, glyph_count, created_at FROM fonts ORDER BY created_at DESC LIMIT $1',
    [limit]
  );
  return rows;
}

async function deleteFont(id) {
  const { rowCount } = await pool.query('DELETE FROM fonts WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { initDB, saveFont, getFont, listFonts, deleteFont };
