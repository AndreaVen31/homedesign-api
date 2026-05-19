const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Inizializzazione automatica al primo avvio del server
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY, tipo TEXT, ambiente TEXT, articolo TEXT NOT NULL,
      marca TEXT, modello TEXT, codice TEXT, note TEXT,
      preventivi JSONB DEFAULT '[]', stato TEXT DEFAULT 'in_valutazione',
      preventivo_scelto INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE products ADD COLUMN IF NOT EXISTS stato TEXT DEFAULT 'in_valutazione';
    ALTER TABLE products ADD COLUMN IF NOT EXISTS preventivo_scelto INTEGER;

    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY, titolo TEXT NOT NULL, descrizione TEXT,
      categoria TEXT, data_scadenza DATE, completato BOOLEAN DEFAULT FALSE,
      priorita TEXT DEFAULT 'media',
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY, nome TEXT NOT NULL, cartella TEXT DEFAULT 'Generale',
      tipo_file TEXT, url TEXT NOT NULL, public_id TEXT, dimensione INTEGER, note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS budget_settings (
      id SERIAL PRIMARY KEY, ambito TEXT UNIQUE NOT NULL, tipo TEXT NOT NULL,
      budget_max NUMERIC(10,2), note TEXT, updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS products_updated_at ON products;
    CREATE TRIGGER products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
    CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    DROP TRIGGER IF EXISTS budget_updated_at ON budget_settings;
    CREATE TRIGGER budget_updated_at BEFORE UPDATE ON budget_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  `);
  console.log('✅ Database inizializzato');
}

module.exports = { pool, initDb };
