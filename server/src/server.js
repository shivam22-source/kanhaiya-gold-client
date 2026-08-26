import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import certificatesRouter from './routes/certificates.routes.js';
import uploadsRouter from './routes/uploads.routes.js';
import branchCashInChargeRouter from './routes/branchCashInCharge.routes.js';
import duesRouter from './routes/dues.routes.js';
import { initDatabase } from './db.js';

const app = express();
const port = Number(process.env.PORT) || 5000;
const allowedOrigins = new Set([
  process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://kanhaiya-gold-client.vercel.app',
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
  res.type('html').send(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>SBI Gold Appraiser Certificate API</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f8fafc;color:#0f172a;font-family:system-ui,sans-serif"><main style="width:min(680px,calc(100% - 32px));padding:36px;background:white;border:1px solid #e2e8f0;border-radius:20px;box-shadow:0 18px 50px rgba(15,23,42,.08)"><div style="display:inline-flex;padding:7px 11px;border-radius:999px;background:#ecfdf5;color:#047857;font-size:13px;font-weight:700">● API is running</div><h1 style="margin:18px 0 8px">SBI Gold Appraiser Certificate</h1><p style="margin:0;color:#475569;line-height:1.6">Backend service is live and ready to handle certificates, records and gold-item uploads.</p><div style="display:grid;gap:12px;margin-top:28px"><a style="padding:16px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;color:#4f46e5;font-weight:700;text-decoration:none" href="/api/health">Health Check</a></div></main></body></html>`);
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/certificates', certificatesRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/branch-cash-in-charge', branchCashInChargeRouter);
app.use('/api/dues', duesRouter);

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
