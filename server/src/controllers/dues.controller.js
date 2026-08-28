import { pool } from '../db.js';

function mapDueRow(row) {
  return {
    id: row.id,
    certificateId: row.certificate_id,
    refNo: row.ref_no,
    borrowerName: row.borrower_name,
    branchName: row.branch_name,
    date: row.certificate_date,
    itemImageUrl: row.item_image_url,
    totalMarketValue: Number(row.total_market_value),
    initialDue: Number(row.initial_due || 0),
    dueAmount: Number(row.due_amount || 0),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    payload: row.payload,
  };
}

function normalizeBranch(branch) {
  return String(branch || '').trim();
}

function parseAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : NaN;
}

export async function listDueCandidates(req, res, next) {
  try {
    const branch = normalizeBranch(req.query.branch);
    if (!branch) return res.status(400).json({ message: 'Branch name is required.' });

    const result = await pool.query(
      `SELECT c.id, c.ref_no, c.borrower_name, c.certificate_date,
              c.item_image_url, c.total_market_value, c.payload,
              (d.id IS NOT NULL) AS already_in_due
       FROM certificates c
       LEFT JOIN certificate_dues d ON d.certificate_id = c.id
       WHERE c.payload->'form'->>'branchName' ILIKE $1
       ORDER BY c.created_at DESC`,
      [`%${branch}%`],
    );

    return res.json(result.rows.map((row) => ({
      id: row.id,
      refNo: row.ref_no,
      borrowerName: row.borrower_name,
      date: row.certificate_date,
      itemImageUrl: row.item_image_url,
      totalMarketValue: Number(row.total_market_value),
      payload: row.payload,
      alreadyInDue: row.already_in_due === true,
    })));
  } catch (error) {
    return next(error);
  }
}

export async function listDues(req, res, next) {
  try {
    const branch = normalizeBranch(req.query.branch);
    const params = [];
    let where = `WHERE d.status = 'active' AND d.due_amount > 0`;

    if (branch) {
      params.push(`%${branch}%`);
      where += ` AND c.payload->'form'->>'branchName' ILIKE $1`;
    }

    const result = await pool.query(
      `SELECT d.id, d.certificate_id, d.initial_due, d.due_amount, d.status,
              d.created_at, d.updated_at, c.ref_no, c.borrower_name,
              c.certificate_date, c.item_image_url, c.total_market_value,
              c.payload, c.payload->'form'->>'branchName' AS branch_name
       FROM certificate_dues d
       JOIN certificates c ON c.id = d.certificate_id
       ${where}
       ORDER BY d.updated_at DESC`,
      params,
    );

    return res.json(result.rows.map(mapDueRow));
  } catch (error) {
    return next(error);
  }
}

export async function createDue(req, res, next) {
  // Kept only for backwards compatibility with older clients; the app now creates dues automatically.
  try {
    const certificateId = String(req.body?.certificateId || '').trim();
    if (!certificateId) return res.status(400).json({ message: 'Certificate ID is required.' });

    const certificateResult = await pool.query(
      `SELECT id, ref_no, borrower_name, certificate_date, item_image_url,
              total_market_value, payload, payload->'form'->>'branchName' AS branch_name
       FROM certificates WHERE id = $1`,
      [certificateId],
    );
    if (!certificateResult.rowCount) return res.status(404).json({ message: 'Certificate not found.' });

    const amount = parseAmount(certificateResult.rows[0].payload?.form?.appraisalCharge);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: 'This certificate has no appraisal charge to track.' });
    }

    const result = await pool.query(
      `INSERT INTO certificate_dues (certificate_id, initial_due, due_amount, status)
       VALUES ($1, $2, $2, 'active')
       ON CONFLICT (certificate_id) DO NOTHING
       RETURNING id, certificate_id, initial_due, due_amount, status, created_at, updated_at`,
      [certificateId, amount],
    );

    if (!result.rowCount) return res.status(409).json({ message: 'Due already exists for this certificate.', code: 'DUE_ALREADY_EXISTS' });

    return res.status(201).json(mapDueRow({ ...certificateResult.rows[0], ...result.rows[0] }));
  } catch (error) {
    return next(error);
  }
}

export async function updateDue(req, res, next) {
  try {
    const certificateId = String(req.params.certificateId || '').trim();
    const dueAmount = parseAmount(req.body?.dueAmount);
    if (!certificateId) return res.status(400).json({ message: 'Certificate ID is required.' });
    if (!Number.isFinite(dueAmount) || dueAmount < 0) {
      return res.status(400).json({ message: 'Due amount must be zero or greater.' });
    }

    const result = await pool.query(
      `UPDATE certificate_dues
       SET due_amount = $1,
           status = CASE WHEN $1 = 0 THEN 'closed' ELSE 'active' END,
           updated_at = NOW()
       WHERE certificate_id = $2
       RETURNING id, certificate_id, initial_due, due_amount, status, created_at, updated_at`,
      [dueAmount, certificateId],
    );

    if (!result.rowCount) return res.status(404).json({ message: 'Due entry not found.' });

    const certificateResult = await pool.query(
      `SELECT id, ref_no, borrower_name, certificate_date, item_image_url,
              total_market_value, payload, payload->'form'->>'branchName' AS branch_name
       FROM certificates WHERE id = $1`,
      [certificateId],
    );
    if (!certificateResult.rowCount) return res.status(404).json({ message: 'Certificate not found.' });

    return res.json(mapDueRow({ ...certificateResult.rows[0], ...result.rows[0] }));
  } catch (error) {
    return next(error);
  }
}

export async function recordPayment(req, res, next) {
  const client = await pool.connect();
  try {
    const certificateId = String(req.params.certificateId || '').trim();
    const amount = parseAmount(req.body?.amount);
    if (!certificateId) return res.status(400).json({ message: 'Certificate ID is required.' });
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Payment amount must be greater than zero.' });
    }

    await client.query('BEGIN');

    const dueResult = await client.query(
      `SELECT id, due_amount, status
       FROM certificate_dues
       WHERE certificate_id = $1
       FOR UPDATE`,
      [certificateId],
    );
    if (!dueResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Due entry not found.' });
    }

    const due = dueResult.rows[0];
    const currentDue = Number(due.due_amount || 0);
    if (due.status !== 'active' || currentDue <= 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'This due is already settled.' });
    }
    if (amount > currentDue) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Payment cannot exceed the current due of ₹${currentDue.toFixed(2)}.` });
    }

    const paymentResult = await client.query(
      `INSERT INTO due_payments (due_id, amount, paid_at)
       VALUES ($1, $2, NOW())
       RETURNING id, due_id, amount, paid_at, created_at`,
      [due.id, amount],
    );

    const updatedDue = await client.query(
      `UPDATE certificate_dues
       SET due_amount = due_amount - $1,
           status = CASE WHEN due_amount - $1 = 0 THEN 'closed' ELSE 'active' END,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, certificate_id, initial_due, due_amount, status, created_at, updated_at`,
      [amount, due.id],
    );

    await client.query('COMMIT');

    return res.status(201).json({
      payment: {
        id: paymentResult.rows[0].id,
        amount: Number(paymentResult.rows[0].amount),
        paidAt: paymentResult.rows[0].paid_at,
        createdAt: paymentResult.rows[0].created_at,
      },
      due: {
        id: updatedDue.rows[0].id,
        certificateId: updatedDue.rows[0].certificate_id,
        initialDue: Number(updatedDue.rows[0].initial_due),
        dueAmount: Number(updatedDue.rows[0].due_amount),
        status: updatedDue.rows[0].status,
      },
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* ignore rollback errors */ }
    return next(error);
  } finally {
    client.release();
  }
}

export async function listPayments(req, res, next) {
  try {
    const certificateId = String(req.params.certificateId || '').trim();
    if (!certificateId) return res.status(400).json({ message: 'Certificate ID is required.' });

    const result = await pool.query(
      `SELECT p.id, p.amount, p.paid_at, p.created_at
       FROM due_payments p
       JOIN certificate_dues d ON d.id = p.due_id
       WHERE d.certificate_id = $1
       ORDER BY p.paid_at DESC, p.id DESC`,
      [certificateId],
    );

    return res.json(result.rows.map((row) => ({
      id: row.id,
      amount: Number(row.amount),
      paidAt: row.paid_at,
      createdAt: row.created_at,
    })));
  } catch (error) {
    return next(error);
  }
}

export async function deleteDue(req, res, next) {
  try {
    const certificateId = String(req.params.certificateId || '').trim();
    if (!certificateId) return res.status(400).json({ message: 'Certificate ID is required.' });

    const result = await pool.query(
      `UPDATE certificate_dues
       SET status = 'closed', updated_at = NOW()
       WHERE certificate_id = $1 AND due_amount = 0
       RETURNING id, certificate_id`,
      [certificateId],
    );

    if (result.rowCount) return res.json({ deleted: true, certificateId });

    const existing = await pool.query(
      'SELECT due_amount, status FROM certificate_dues WHERE certificate_id = $1',
      [certificateId],
    );
    if (!existing.rowCount) return res.status(404).json({ message: 'Due entry not found.' });
    return res.status(403).json({ message: 'Cannot remove — due amount is not zero.' });
  } catch (error) {
    return next(error);
  }
}
