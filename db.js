const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // richiesto da Render
});

// Crea la tabella se non esiste ancora
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id          SERIAL PRIMARY KEY,
      tipo        TEXT,
      ambiente    TEXT,
      articolo    TEXT NOT NULL,
      marca       TEXT,
      modello     TEXT,
      codice      TEXT,
      note        TEXT,
      preventivi  JSONB DEFAULT '[]',
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE OR REPLACE FUNCTION update_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS products_updated_at ON products;
    CREATE TRIGGER products_updated_at
      BEFORE UPDATE ON products
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  `);
  console.log('✅ Database pronto');
}

// Query helpers
const db = {
  getAll: () =>
    pool.query('SELECT * FROM products ORDER BY created_at DESC'),

  getById: (id) =>
    pool.query('SELECT * FROM products WHERE id = $1', [id]),

  create: ({ tipo, ambiente, articolo, marca, modello, codice, note, preventivi }) =>
    pool.query(
      `INSERT INTO products (tipo, ambiente, articolo, marca, modello, codice, note, preventivi)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [tipo, ambiente, articolo, marca, modello, codice, note, JSON.stringify(preventivi || [])]
    ),

  update: (id, { tipo, ambiente, articolo, marca, modello, codice, note, preventivi }) =>
    pool.query(
      `UPDATE products
       SET tipo=$1, ambiente=$2, articolo=$3, marca=$4, modello=$5, codice=$6, note=$7, preventivi=$8
       WHERE id=$9 RETURNING *`,
      [tipo, ambiente, articolo, marca, modello, codice, note, JSON.stringify(preventivi || []), id]
    ),

  delete: (id) =>
    pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]),
};

module.exports = { initDb, db };
