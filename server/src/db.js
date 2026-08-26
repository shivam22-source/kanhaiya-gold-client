import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function initDatabase() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS certificates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      borrower_name TEXT NOT NULL,
      ref_no TEXT,
      certificate_date DATE,
      item_image_url TEXT,
      total_market_value NUMERIC(14, 2) NOT NULL DEFAULT 0,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query('ALTER TABLE certificates ADD COLUMN IF NOT EXISTS item_image_url TEXT;');

  await pool.query(`
    CREATE INDEX IF NOT EXISTS certificates_search_idx
    ON certificates
    USING GIN (
      to_tsvector('simple', coalesce(borrower_name, '') || ' ' || coalesce(ref_no, ''))
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS certificate_dues (
      id BIGSERIAL PRIMARY KEY,
      certificate_id UUID NOT NULL UNIQUE
        REFERENCES certificates(id) ON DELETE CASCADE,
      due_amount NUMERIC(12, 2) NOT NULL DEFAULT 0
        CHECK (due_amount >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_certificates_branch
    ON certificates ((payload->'form'->>'branchName'));
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_certificate_dues_certificate_id
    ON certificate_dues (certificate_id);
  `);
}
