import { pool } from '../db.js';

let tableReady;

async function ensureBranchTable() {
  if (!tableReady) {
    tableReady = pool.query(`
      CREATE TABLE IF NOT EXISTS branch_cash_in_charge (
        branch_key TEXT PRIMARY KEY,
        branch_name TEXT NOT NULL,
        cash_in_charge TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `).catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  await tableReady;
}

function normalizeBranchKey(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function mapRow(row) {
  return {
    branchKey: row.branch_key,
    branchName: row.branch_name,
    cashInCharge: row.cash_in_charge,
    updatedAt: row.updated_at,
  };
}

export async function listBranchCashInCharge(req, res, next) {
  try {
    await ensureBranchTable();
    const result = await pool.query(
      `SELECT branch_key, branch_name, cash_in_charge, updated_at
       FROM branch_cash_in_charge
       ORDER BY branch_name ASC`,
    );
    return res.json(result.rows.map(mapRow));
  } catch (error) {
    return next(error);
  }
}

export async function upsertBranchCashInCharge(req, res, next) {
  try {
    await ensureBranchTable();
    const branchName = String(req.body?.branchName || '').trim();
    const cashInCharge = String(req.body?.cashInCharge || '').trim();
    const branchKey = normalizeBranchKey(branchName);

    if (!branchKey || !cashInCharge) {
      return res.status(400).json({ message: 'Branch name and cash-in-charge are required.' });
    }

    const existing = await pool.query(
      `SELECT branch_name, cash_in_charge
       FROM branch_cash_in_charge
       WHERE branch_key = $1`,
      [branchKey],
    );

    if (existing.rowCount) {
      const row = existing.rows[0];
      return res.status(409).json({
        code: 'BRANCH_ALREADY_EXISTS',
        message: `${row.branch_name} is already present with ${row.cash_in_charge}. Update it from the Manage Cash-in-Charge List instead.`,
        branchName: row.branch_name,
        cashInCharge: row.cash_in_charge,
      });
    }

    try {
      const result = await pool.query(
        `INSERT INTO branch_cash_in_charge (branch_key, branch_name, cash_in_charge)
         VALUES ($1, $2, $3)
         RETURNING branch_key, branch_name, cash_in_charge, updated_at`,
        [branchKey, branchName, cashInCharge],
      );

      return res.status(201).json(mapRow(result.rows[0]));
    } catch (error) {
      if (error.code === '23505') {
        const duplicate = await pool.query(
          `SELECT branch_name, cash_in_charge
           FROM branch_cash_in_charge
           WHERE branch_key = $1`,
          [branchKey],
        );
        const row = duplicate.rows[0];
        return res.status(409).json({
          code: 'BRANCH_ALREADY_EXISTS',
          message: `${row?.branch_name || branchName} is already present${row?.cash_in_charge ? ` with ${row.cash_in_charge}` : ''}. Update it from the Manage Cash-in-Charge List instead.`,
          branchName: row?.branch_name || branchName,
          cashInCharge: row?.cash_in_charge || '',
        });
      }
      throw error;
    }
  } catch (error) {
    return next(error);
  }
}

export async function updateBranchCashInCharge(req, res, next) {
  try {
    await ensureBranchTable();
    const oldKey = normalizeBranchKey(req.params.branchKey);
    const branchName = String(req.body?.branchName || '').trim();
    const cashInCharge = String(req.body?.cashInCharge || '').trim();
    const newKey = normalizeBranchKey(branchName);

    if (!oldKey || !newKey || !cashInCharge) {
      return res.status(400).json({ message: 'Branch name and cash-in-charge are required.' });
    }

    const result = await pool.query(
      `UPDATE branch_cash_in_charge
       SET branch_key = $1,
           branch_name = $2,
           cash_in_charge = $3,
           updated_at = NOW()
       WHERE branch_key = $4
       RETURNING branch_key, branch_name, cash_in_charge, updated_at`,
      [newKey, branchName, cashInCharge, oldKey],
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: 'Branch mapping not found.' });
    }

    return res.json(mapRow(result.rows[0]));
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'That branch already exists. Update the existing entry instead.' });
    }
    return next(error);
  }
}

export async function deleteBranchCashInCharge(req, res, next) {
  try {
    await ensureBranchTable();
    const branchKey = normalizeBranchKey(req.params.branchKey);
    const result = await pool.query(
      'DELETE FROM branch_cash_in_charge WHERE branch_key = $1 RETURNING branch_key',
      [branchKey],
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: 'Branch mapping not found.' });
    }

    return res.json({ deleted: true, branchKey });
  } catch (error) {
    return next(error);
  }
}
