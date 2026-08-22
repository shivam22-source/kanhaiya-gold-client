import { Router } from 'express';
import multer from 'multer';
import { uploadGoldItemImage } from '../controllers/uploads.controller.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
  fileFilter(_req, file, callback) {
    if (!file.mimetype.startsWith('image/')) {
      callback(new Error('Only image files are allowed.'));
      return;
    }
    callback(null, true);
  },
});

router.post('/gold-item', upload.single('image'), uploadGoldItemImage);

export default router;
