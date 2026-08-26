import { Router } from 'express';
import {
  deleteBranchCashInCharge,
  listBranchCashInCharge,
  updateBranchCashInCharge,
  upsertBranchCashInCharge,
} from '../controllers/branchCashInCharge.controller.js';

const router = Router();

router.get('/', listBranchCashInCharge);
router.post('/', upsertBranchCashInCharge);
router.put('/:branchKey', updateBranchCashInCharge);
router.delete('/:branchKey', deleteBranchCashInCharge);

export default router;
