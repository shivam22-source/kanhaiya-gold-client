import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS certificates (
      id BIGSERIAL PRIMARY KEY,
      borrower_name TEXT NOT NULL,
      ref_no TEXT,
      certificate_date DATE,
      item_image_url TEXT,
      total_market_value NUMERIC(14,2) NOT NULL DEFAULT 0,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS certificate_dues (
      id BIGSERIAL PRIMARY KEY,
      certificate_id BIGINT NOT NULL UNIQUE REFERENCES certificates(id) ON DELETE CASCADE,
      initial_due NUMERIC(14,2) NOT NULL DEFAULT 0,
      due_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS due_payments (
      id BIGSERIAL PRIMARY KEY,
      due_id BIGINT NOT NULL REFERENCES certificate_dues(id) ON DELETE CASCADE,
      amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
      paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS deleted_certificate_payment_history (
      id BIGSERIAL PRIMARY KEY,
      certificate_id BIGINT NOT NULL,
      ref_no TEXT,
      payment_amount NUMERIC(14,2) NOT NULL CHECK (payment_amount > 0),
      paid_at TIMESTAMPTZ NOT NULL,
      archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_certificates_created_at ON certificates(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_certificates_ref_no ON certificates(ref_no);
    CREATE INDEX IF NOT EXISTS idx_due_payments_due_id ON due_payments(due_id);
    CREATE INDEX IF NOT EXISTS idx_deleted_payment_history_certificate_id ON deleted_certificate_payment_history(certificate_id);
  `);
}
