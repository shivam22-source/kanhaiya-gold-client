# SBI Gold Appraiser Certificate

[![Kanhaiya Gold Backup](https://github.com/shivam22-source/kanhaiya-gold-client/actions/workflows/backup.yml/badge.svg)](https://github.com/shivam22-source/kanhaiya-gold-client/actions/workflows/backup.yml)

A web application for creating, saving, searching, and regenerating SBI gold-loan appraiser certificates (Annexure PL-61(i)).

## Live deployment architecture

```text
Browser
  │
  ▼
Vercel — React/Vite frontend
  │
  │ VITE_API_URL
  ▼
Render — Node/Express API
  │
  ├── PostgreSQL — certificate records
  └── Cloudinary — gold-item images (recommended)
```

## Local development

### Frontend

```bash
cd client
npm ci
npm run dev
```

Set `VITE_API_URL` in `client/.env` when the API is not running at the default local address.

### Backend

```bash
cd server
npm ci
npm start
```

Create `server/.env` from `server/.env.example`.

### PostgreSQL

For local development:

```bash
docker compose up -d postgres
```

The server initializes the required `certificates` table automatically when it starts.

## Deployment

### 1. Deploy the API + database on Render

Use the repository's `render.yaml` as a Blueprint. It creates:

- `kanhaiya-gold-api` — Node/Express web service
- `kanhaiya-gold-db` — PostgreSQL database

Set these environment variables on the API service:

```text
CLIENT_ORIGIN=https://YOUR-VERCEL-DOMAIN
CLOUDINARY_URL=cloudinary://...
```

`DATABASE_URL` is linked automatically by the Render blueprint.

After deployment, verify:

```text
https://YOUR-RENDER-SERVICE.onrender.com/api/health
```

Expected response:

```json
{"ok":true}
```

### 2. Deploy the frontend on Vercel

Import the GitHub repository into Vercel. The root-level `vercel.json` already configures the build from `client/` and supports React Router routes.

Set this Vercel environment variable:

```text
VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api
```

Every push to `main` can then produce a new deployed frontend build through Vercel's Git integration.

## Automated backup

The GitHub Actions workflow `Kanhaiya Gold Backup` backs up the production PostgreSQL database to the dedicated Google Drive account. Database backups run daily; Cloudinary image backups run weekly and can also be triggered manually from GitHub Actions.

Backup credentials are stored only as GitHub Actions/Render environment secrets and are never committed to the repository.

## Important production notes

- Do not commit real `.env` files or service credentials.
- Use Cloudinary (or another durable object store) in production; local filesystem uploads on ephemeral hosts are not durable.
- PostgreSQL is the source of truth for saved certificates.
- Certificate calculations are currently performed in the frontend and stored as a JSONB snapshot; server-side recalculation/validation is a future hardening step.
