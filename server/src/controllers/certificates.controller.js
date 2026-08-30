import { pool } from '../db.js';

function certificateRow(row) {
  return {
    id: row.id,
    borrowerName: row.borrower_name,
    refNo: row.ref_no,
    date: row.certificate_date,
    itemImageUrl: row.item_image_url,
    totalMarketValue: Number(row.total_market_value),
    payload: row.payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isLatest: row.is_latest === true,
  };
}

export async function createCertificate(req, res, next) {
  const client = await pool.connect();
  try {
    const payload = req.body;
    const form = payload.form || {};
    const shop = payload.shop || {};
    const totals = payload.totals || {};

    if (!form.borrowerName) return res.status(400).json({ message: 'Borrower name is required.' });

    const appraisalCharge = Math.max(Number(form.appraisalCharge) || 0, 0);
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO certificates (borrower_name, ref_no, certificate_date, item_image_url, total_market_value, payload)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [form.borrowerName, form.refNo || null, form.date || null, shop.itemImageUrl || null, Number(totals.marketValue) || 0, payload],
    );

    const certificate = result.rows[0];
    if (appraisalCharge > 0) {
      await client.query(
        `INSERT INTO certificate_dues (certificate_id, initial_due, due_amount, status)
         VALUES ($1, $2, $2, 'active')
         ON CONFLICT (certificate_id) DO UPDATE
           SET initial_due = EXCLUDED.initial_due,
               due_amount = EXCLUDED.due_amount,
               status = 'active',
               updated_at = NOW()`,
        [certificate.id, appraisalCharge],
      );
    }

    await client.query('COMMIT');
    return res.status(201).json(certificateRow({ ...certificate, is_latest: true }));
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* ignore rollback errors */ }
    return next(error);
  } finally {
    client.release();
  }
}

export async function listCertificates(req, res, next) {
  try {
    const search = String(req.query.search || '').trim();
    const params = [];
    let where = '';
    if (search) {
      params.push(`%${search}%`);
      where = `WHERE borrower_name ILIKE $1 OR ref_no ILIKE $1`;
    }
    const result = await pool.query(`SELECT * FROM certificates ${where} ORDER BY created_at DESC LIMIT 100`, params);
    return res.json(result.rows.map(certificateRow));
  } catch (error) { return next(error); }
}

export async function getCertificate(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT c.*,
              regexp_match(c.ref_no, '^KJ[-\\s]?(\\d+)$', 'i') AS ref_match,
              MAX((regexp_match(c2.ref_no, '^KJ[-\\s]?(\\d+)$', 'i'))[1]::int) OVER () AS max_serial
       FROM certificates c
       LEFT JOIN certificates c2 ON c2.ref_no ~* '^KJ[-\\s]?(\\d+)$'
       WHERE c.id = $1
       LIMIT 1`,
      [req.params.id],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Certificate not found.' });
    const row = result.rows[0];
    const currentSerial = Number(row.ref_match?.[1]) || 0;
    const maxSerial = Number(row.max_serial) || 0;
    return res.json(certificateRow({ ...row, is_latest: currentSerial > 0 && currentSerial === maxSerial }));
  } catch (error) { return next(error); }
}

export async function deleteCertificate(req, res, next) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const targetResult = await client.query(
      `SELECT id, ref_no FROM certificates WHERE id = $1 FOR UPDATE`,
      [req.params.id],
    );
    if (!targetResult.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Certificate not found.' }); }

    const target = targetResult.rows[0];

    const escapedPrefix = 'KJ'.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
    const pattern = `^${escapedPrefix}[-\\s]?(\\d+)$`;
    const latestResult = await client.query(
      `SELECT id, ref_no, (regexp_match(ref_no, $1, 'i'))[1]::int AS serial_no
       FROM certificates
       WHERE ref_no ~* $1
       ORDER BY serial_no DESC
       LIMIT 1
       FOR UPDATE`,
      [pattern],
    );

    const latest = latestResult.rows[0] || null;
    if (!(latest && String(latest.id) === String(target.id))) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Only the latest certificate can be deleted.', latestRefNo: latest?.ref_no || null });
    }

    // Preserve every payment as an audit record before the certificate is deleted.
    // The normal due/payment rows may then be removed by the certificate's
    // ON DELETE CASCADE without losing the transaction history.
    await client.query(
      `INSERT INTO deleted_certificate_payment_history
         (certificate_id, ref_no, payment_amount, paid_at)
       SELECT d.certificate_id, $2, p.amount, p.paid_at
       FROM due_payments p
       JOIN certificate_dues d ON d.id = p.due_id
       WHERE d.certificate_id = $1`,
      [target.id, target.ref_no || null],
    );

    await client.query('DELETE FROM certificates WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');

    const nextNumber = Math.max(1, Number(latest.serial_no) || 1);
    return res.json({ deleted: true, deletedRefNo: target.ref_no || null, deletedWasLatest: true, nextRefNo: `KJ-${nextNumber}` });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* Ignore rollback failures. */ }
    return next(error);
  } finally { client.release(); }
}

export async function getNextSerial(req, res, next) {
  try {
    const prefix = String(req.query.prefix || 'KJ').trim() || 'KJ';
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&');
    const pattern = `^${escapedPrefix}[-\\s]?(\\d+)$`;
    const result = await pool.query(
      `SELECT MAX((regexp_match(ref_no, $1))[1]::int) AS max_no
       FROM certificates WHERE ref_no ~* $1`,
      [pattern],
    );
    const maxNo = Number(result.rows[0]?.max_no) || 0;
    const baseline = prefix.toUpperCase() === 'KJ' ? 682 : 0;
    const nextNumber = Math.max(baseline, maxNo + 1);
    return res.json({ prefix, nextNumber, nextRefNo: `${prefix}-${nextNumber}` });
  } catch (error) { return next(error); }
}
