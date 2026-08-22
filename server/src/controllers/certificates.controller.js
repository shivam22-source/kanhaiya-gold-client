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
  };
}

export async function createCertificate(req, res, next) {
  try {
    const payload = req.body;
    const form = payload.form || {};
    const shop = payload.shop || {};
    const totals = payload.totals || {};

    if (!form.borrowerName) {
      return res.status(400).json({ message: 'Borrower name is required.' });
    }

    const result = await pool.query(
      `INSERT INTO certificates (borrower_name, ref_no, certificate_date, item_image_url, total_market_value, payload)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        form.borrowerName,
        form.refNo || null,
        form.date || null,
        shop.itemImageUrl || null,
        Number(totals.marketValue) || 0,
        payload,
      ],
    );

    return res.status(201).json(certificateRow(result.rows[0]));
  } catch (error) {
    return next(error);
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

    const result = await pool.query(
      `SELECT *
       FROM certificates
       ${where}
       ORDER BY created_at DESC
       LIMIT 100`,
      params,
    );

    return res.json(result.rows.map(certificateRow));
  } catch (error) {
    return next(error);
  }
}

export async function getCertificate(req, res, next) {
  try {
    const result = await pool.query('SELECT * FROM certificates WHERE id = $1', [req.params.id]);

    if (!result.rowCount) {
      return res.status(404).json({ message: 'Certificate not found.' });
    }

    return res.json(certificateRow(result.rows[0]));
  } catch (error) {
    return next(error);
  }
}
