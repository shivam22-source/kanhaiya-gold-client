import { Router } from 'express';
import {
  createDue,
  deleteDue,
  listDueCandidates,
  listDues,
  updateDue,
} from '../controllers/dues.controller.js';

const router = Router();

router.get('/candidates', listDueCandidates);
router.get('/', listDues);
router.post('/', createDue);
router.put('/:certificateId', updateDue);
router.delete('/:certificateId', deleteDue);

export default router;
