import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import certificatesRouter from './routes/certificates.routes.js';
import uploadsRouter from './routes/uploads.routes.js';
import { initDatabase } from './db.js';

const app = express();
const port = Number(process.env.PORT) || 5000;
const allowedOrigins = new Set([
  process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
  }),
);
app.use(express.json({ limit: '10mb' }));
app.use('/storage/gold-items', express.static(path.resolve('uploads/gold-items')));

app.get('/', (_req, res) => {
  res.json({
    name: 'SBI Gold Appraiser Certificate API',
    status: 'ok',
    health: '/api/health',
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/certificates', certificatesRouter);
app.use('/api/uploads', uploadsRouter);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: 'Server error', detail: error.message });
});

initDatabase()
  .then(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`Server running on 0.0.0.0:${port}`);
    });
  })
  .catch((error) => {
    console.error('Database initialization failed.');
    console.error(error);
    process.exit(1);
  });
