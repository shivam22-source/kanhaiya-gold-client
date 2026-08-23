import { Router } from 'express';
import { createCertificate, getCertificate, getNextSerial, listCertificates } from '../controllers/certificates.controller.js';

const router = Router();

router.post('/', createCertificate);
router.get('/', listCertificates);
router.get('/next-serial', getNextSerial);
router.get('/:id', getCertificate);

export default router;
