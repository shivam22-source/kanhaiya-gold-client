import { Router } from 'express';
import { createCertificate, deleteCertificate, getCertificate, listCertificates } from '../controllers/certificates.controller.js';
import { getNextSerial } from '../controllers/nextSerial.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/', createCertificate);
router.get('/', listCertificates);
router.get('/next-serial', getNextSerial);
router.get('/:id', getCertificate);
router.delete('/:id', deleteCertificate);

export default router;
