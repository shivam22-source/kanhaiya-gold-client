import { Router } from 'express';
import { getMarketRates } from '../controllers/marketRates.controller.js';

const router = Router();

router.get('/', getMarketRates);

export default router;
