import { Router } from 'express';
import {
  createDue,
  deleteDue,
  listDueCandidates,
  listDues,
  listPayments,
  recordPayment,
  updateDue,
} from '../controllers/dues.controller.js';

const router = Router();

router.get('/candidates', listDueCandidates);
router.get('/certificate/:certificateId/payments', listPayments);
router.get('/', listDues);
router.post('/', createDue);
router.post('/:certificateId/payments', recordPayment);
router.put('/:certificateId', updateDue);
router.delete('/:certificateId', deleteDue);

export default router;
