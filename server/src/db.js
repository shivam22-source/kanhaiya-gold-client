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
      initial_due NUMERIC(12, 2) NOT NULL DEFAULT 0
        CHECK (initial_due >= 0),
      due_amount NUMERIC(12, 2) NOT NULL DEFAULT 0
        CHECK (due_amount >= 0),
      status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'closed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query('ALTER TABLE certificate_dues ADD COLUMN IF NOT EXISTS initial_due NUMERIC(12, 2) NOT NULL DEFAULT 0;');
  await pool.query("ALTER TABLE certificate_dues ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';");
  await pool.query("UPDATE certificate_dues SET initial_due = due_amount WHERE initial_due = 0 AND due_amount > 0;");
  await pool.query("UPDATE certificate_dues SET status = CASE WHEN due_amount = 0 THEN 'closed' ELSE 'active' END;");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS due_payments (
      id BIGSERIAL PRIMARY KEY,
      due_id BIGINT NOT NULL REFERENCES certificate_dues(id) ON DELETE CASCADE,
      amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
      paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_certificate_dues_status
    ON certificate_dues (status, updated_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_due_payments_due_id_paid_at
    ON due_payments (due_id, paid_at DESC);
  `);

  // Backfill due accounts for certificates created before automatic due tracking existed.
  await pool.query(`
    INSERT INTO certificate_dues (certificate_id, initial_due, due_amount, status)
    SELECT
      c.id,
      GREATEST(COALESCE(NULLIF(c.payload->'form'->>'appraisalCharge', '')::numeric, 0), 0),
      GREATEST(COALESCE(NULLIF(c.payload->'form'->>'appraisalCharge', '')::numeric, 0), 0),
      CASE
        WHEN GREATEST(COALESCE(NULLIF(c.payload->'form'->>'appraisalCharge', '')::numeric, 0), 0) = 0 THEN 'closed'
        ELSE 'active'
      END
    FROM certificates c
    LEFT JOIN certificate_dues d ON d.certificate_id = c.id
    WHERE d.id IS NULL
      AND GREATEST(COALESCE(NULLIF(c.payload->'form'->>'appraisalCharge', '')::numeric, 0), 0) > 0
    ON CONFLICT (certificate_id) DO NOTHING;
  `);
}
