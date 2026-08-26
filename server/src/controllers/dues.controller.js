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
    dueAmount: Number(row.due_amount),
    payload: row.payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeBranch(branch) {
  return String(branch || '').trim();
}

function parseDueAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : NaN;
}

export async function listDueCandidates(req, res, next) {
  try {
    const branch = normalizeBranch(req.query.branch);
    if (!branch) {
      return res.status(400).json({ message: 'Branch name is required.' });
    }

    const result = await pool.query(
      `SELECT
         c.id,
         c.ref_no,
         c.borrower_name,
         c.certificate_date,
         c.item_image_url,
         c.total_market_value,
         c.payload,
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
    let where = '';

    if (branch) {
      params.push(`%${branch}%`);
      where = `WHERE c.payload->'form'->>'branchName' ILIKE $1`;
    }

    const result = await pool.query(
      `SELECT
         d.id,
         d.certificate_id,
         d.due_amount,
         d.created_at,
         d.updated_at,
         c.ref_no,
         c.borrower_name,
         c.certificate_date,
         c.item_image_url,
         c.total_market_value,
         c.payload,
         c.payload->'form'->>'branchName' AS branch_name
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
  try {
    const certificateId = String(req.body?.certificateId || '').trim();
    const dueAmount = parseDueAmount(req.body?.dueAmount);

    if (!certificateId) {
      return res.status(400).json({ message: 'Certificate ID is required.' });
    }
    if (!Number.isFinite(dueAmount) || dueAmount < 0) {
      return res.status(400).json({ message: 'Due amount must be zero or greater.' });
    }

    const certificateResult = await pool.query(
      `SELECT
         id,
         ref_no,
         borrower_name,
         certificate_date,
         item_image_url,
         total_market_value,
         payload,
         payload->'form'->>'branchName' AS branch_name
       FROM certificates
       WHERE id = $1`,
      [certificateId],
    );

    if (!certificateResult.rowCount) {
      return res.status(404).json({ message: 'Certificate not found.' });
    }

    const certificate = certificateResult.rows[0];

    try {
      const result = await pool.query(
        `INSERT INTO certificate_dues (certificate_id, due_amount)
         VALUES ($1, $2)
         RETURNING id, certificate_id, due_amount, created_at, updated_at`,
        [certificateId, dueAmount],
      );

      return res.status(201).json(mapDueRow({
        ...certificate,
        ...result.rows[0],
      }));
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({ message: 'Due already exists for this certificate.', code: 'DUE_ALREADY_EXISTS' });
      }
      throw error;
    }
  } catch (error) {
    return next(error);
  }
}

export async function updateDue(req, res, next) {
  try {
    const certificateId = String(req.params.certificateId || '').trim();
    const dueAmount = parseDueAmount(req.body?.dueAmount);

    if (!certificateId) {
      return res.status(400).json({ message: 'Certificate ID is required.' });
    }
    if (!Number.isFinite(dueAmount) || dueAmount < 0) {
      return res.status(400).json({ message: 'Due amount must be zero or greater.' });
    }

    const result = await pool.query(
      `UPDATE certificate_dues
       SET due_amount = $1,
           updated_at = NOW()
       WHERE certificate_id = $2
       RETURNING id, certificate_id, due_amount, created_at, updated_at`,
      [dueAmount, certificateId],
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: 'Due entry not found.' });
    }

    const certificateResult = await pool.query(
      `SELECT
         id,
         ref_no,
         borrower_name,
         certificate_date,
         item_image_url,
         total_market_value,
         payload,
         payload->'form'->>'branchName' AS branch_name
       FROM certificates
       WHERE id = $1`,
      [certificateId],
    );

    if (!certificateResult.rowCount) {
      return res.status(404).json({ message: 'Certificate not found.' });
    }

    return res.json(mapDueRow({
      ...certificateResult.rows[0],
      ...result.rows[0],
    }));
  } catch (error) {
    return next(error);
  }
}

export async function deleteDue(req, res, next) {
  try {
    const certificateId = String(req.params.certificateId || '').trim();

    if (!certificateId) {
      return res.status(400).json({ message: 'Certificate ID is required.' });
    }

    const result = await pool.query(
      `DELETE FROM certificate_dues
       WHERE certificate_id = $1
         AND due_amount = 0
       RETURNING id, certificate_id`,
      [certificateId],
    );

    if (result.rowCount) {
      return res.json({ deleted: true, certificateId });
    }

    const existing = await pool.query(
      'SELECT due_amount FROM certificate_dues WHERE certificate_id = $1',
      [certificateId],
    );

    if (!existing.rowCount) {
      return res.status(404).json({ message: 'Due entry not found.' });
    }

    return res.status(403).json({ message: 'Cannot delete — due amount is not zero.' });
  } catch (error) {
    return next(error);
  }
}
