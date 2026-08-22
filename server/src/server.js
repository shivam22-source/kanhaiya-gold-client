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
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SBI Gold Appraiser Certificate API</title>
  <style>
    :root { color-scheme: light; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f8fafc; color: #0f172a; }
    .card { width: min(680px, calc(100% - 32px)); padding: 36px; background: white; border: 1px solid #e2e8f0; border-radius: 20px; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08); }
    .badge { display: inline-flex; align-items: center; gap: 8px; padding: 7px 11px; border-radius: 999px; background: #ecfdf5; color: #047857; font-size: 13px; font-weight: 700; }
    .dot { width: 9px; height: 9px; border-radius: 50%; background: #10b981; }
    h1 { margin: 18px 0 8px; font-size: clamp(28px, 5vw, 42px); line-height: 1.1; }
    p { margin: 0; color: #475569; line-height: 1.6; }
    .meta { display: grid; gap: 12px; margin-top: 28px; }
    .row { padding: 16px 18px; border: 1px solid #e2e8f0; border-radius: 14px; background: #f8fafc; }
    .label { display: block; margin-bottom: 4px; font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #64748b; }
    a { color: #4f46e5; font-weight: 700; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .footer { margin-top: 24px; font-size: 13px; color: #94a3b8; }
  </style>
</head>
<body>
  <main class="card">
    <span class="badge"><span class="dot"></span> API is running</span>
    <h1>SBI Gold Appraiser Certificate</h1>
    <p>Backend service is live and ready to handle certificates, records, and gold-item uploads.</p>
    <section class="meta">
      <div class="row"><span class="label">Status</span>Operational</div>
      <div class="row"><span class="label">Health Check</span><a href="/api/health">/api/health</a></div>
      <div class="row"><span class="label">Certificates API</span><a href="/api/certificates">/api/certificates</a></div>
    </section>
    <div class="footer">Kanhaiya Gold Appraiser • Node.js + Express + PostgreSQL</div>
  </main>
</body>
</html>`);
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
