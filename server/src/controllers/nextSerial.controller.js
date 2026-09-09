import { pool } from '../db.js';

export async function getNextSerial(req, res, next) {
  try {
    const prefix = String(req.query.prefix || 'KJ').trim() || 'KJ';
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
