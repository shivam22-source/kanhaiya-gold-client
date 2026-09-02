# Kanhaiya Gold — SBI Gold Appraiser Certificate

> A practical full-stack web application for creating, saving, searching, exporting, and regenerating SBI-style gold-loan appraisal certificates.

[![Kanhaiya Gold Backup](https://github.com/shivam22-source/kanhaiya-gold-client/actions/workflows/backup.yml/badge.svg)](https://github.com/shivam22-source/kanhaiya-gold-client/actions/workflows/backup.yml)

---

## 👋 What is this project?

Kanhaiya Gold is built around a simple real-world workflow: a gold appraiser enters borrower and jewellery details, the application calculates the appraisal values, generates the certificate PDF, stores the record, and makes the certificate available later through the Records section.

The goal is not to build an unnecessarily complicated system. The architecture uses a **React frontend + small Express API + PostgreSQL**, with focused services for PDF generation, image storage, QR codes, and backups.

<details>
<summary><strong>▶ See the complete workflow</strong></summary>

```text
Enter Certificate Details
        ↓
Calculate Weight / Purity / Market Value
        ↓
Generate Certificate PDF
        ↓
Save Certificate Snapshot
        ↓
PostgreSQL
        ↓
Records
   ├── Search
   ├── Filter
   ├── Sort
   ├── Export CSV / Excel
   └── Open / Regenerate Certificate
```

For gold-item photos:

```text
Upload Photo
     ↓
Express API
     ↓
Cloudinary / local development storage
     ↓
Image URL
     ↓
QR Code in certificate
```

</details>

---

## ✨ What can it do?

| Area | What it provides |
|---|---|
| 📄 Certificate | Create SBI-style gold appraisal certificates |
| 🧮 Calculations | Weight, purity, rate and market-value calculations |
| 🧩 Flexible rows | Multiple jewellery items and custom columns |
| 🏷️ Purity summary | Automatically groups appraisal rows by purity |
| 🇮🇳 Amount in words | Indian numbering system such as Lakh/Crore |
| 🖼️ Item photo | Upload and attach gold-item images |
| 🔳 QR code | QR points to the uploaded item image |
| 💾 Records | Save and reopen previous certificates |
| 🔎 Search | Search records by borrower or reference number |
| 🎛️ Filters | Date, value, purity and sorting filters |
| 📊 Export | Download filtered records as CSV or Excel-compatible `.xlsx` |
| 💳 Due tracking | View appraisal dues and payment history |
| ♻️ Regenerate | Recreate a saved certificate PDF from its stored snapshot |
| 🗑️ Safe deletion | Only the latest certificate can be deleted |
| 📱 Responsive UI | Desktop records plus a mobile-friendly records experience |
| ☁️ Backup | Automated PostgreSQL backup through GitHub Actions |

---

## 🧠 A few engineering decisions

The project deliberately keeps the architecture easy to understand:

### 1. React handles the application UI

React state and hooks are used for form state, calculations, filtering and page interactions. There is no unnecessary global state-management library for the current scope.

### 2. Express provides a small REST API

The backend handles certificate persistence, record retrieval, uploads and due/payment operations. The frontend communicates with it through a configurable API URL.

### 3. PostgreSQL stores the important data

Common fields such as borrower name, reference number, date and total value are kept as normal columns for efficient listing/searching.

The complete certificate is also stored as a **JSONB snapshot**. This keeps the certificate flexible when rows or custom columns change and allows an old certificate to be reopened and regenerated using the same saved data.

### 4. PDF generation is kept separate

PDF rendering lives in its own utility instead of depending on the browser DOM. This keeps the certificate layout predictable and easier to maintain.

### 5. External services are used only where they add value

- **Cloudinary** → durable image storage in production
- **Google Drive** → backup destination
- **GitHub Actions** → scheduled backup automation
- **Vercel** → frontend deployment
- **Render** → backend + PostgreSQL deployment

---

## 🛠️ Tech Stack

### Frontend

- **React 19** — UI and application state
- **Vite** — development server and production build
- **Tailwind CSS** — responsive UI styling
- **React Router** — page navigation

### Backend

- **Node.js** — server runtime
- **Express 5** — REST API
- **PostgreSQL** — persistent application data
- **pg** — PostgreSQL connection/query layer

### Document & media

- **jsPDF** — certificate PDF generation
- **jsPDF AutoTable** — tabular PDF layout
- **QRCode** — QR generation
- **Multer** — image upload handling
- **Cloudinary** — production image storage

### Operations

- **Vercel** — frontend hosting
- **Render** — API hosting and PostgreSQL deployment
- **GitHub Actions** — automated backups
- **Google Drive API** — backup storage

<details>
<summary><strong>💬 Interview-friendly stack explanation</strong></summary>

> "I built the application with React and Vite on the frontend, and Node.js with Express on the backend. PostgreSQL is the main database. I kept the certificate itself as a JSONB snapshot so the structure can remain flexible while common searchable fields stay relational. PDF generation is handled separately with jsPDF, and Cloudinary is used for image storage. The frontend is deployed on Vercel, the API/database on Render, and GitHub Actions handles automated backups."

</details>

---

## 🏗️ Architecture

```text
                         ┌─────────────────────┐
                         │       Browser       │
                         │   React + Vite      │
                         └──────────┬──────────┘
                                    │ REST API
                                    │ VITE_API_URL
                                    ▼
                         ┌─────────────────────┐
                         │   Node + Express    │
                         │       API           │
                         └──────┬───────┬──────┘
                                │       │
                    ┌───────────┘       └────────────┐
                    ▼                                ▼
             ┌─────────────┐                  ┌─────────────┐
             │ PostgreSQL  │                  │ Cloudinary  │
             │ Certificates│                  │ Item Images │
             └─────────────┘                  └─────────────┘
                    ▲
                    │ backup
                    │
             ┌─────────────┐
             │ GitHub      │
             │ Actions     │──────► Google Drive
             └─────────────┘
```

### Data flow

```text
Dashboard
  → user enters appraisal data
  → frontend calculates row values and totals
  → certificate snapshot is saved through API
  → PostgreSQL stores the record
  → PDF is generated from the same certificate state

Records
  → API loads saved records
  → borrower/ref search
  → browser applies date/value/purity filters
  → user can inspect, regenerate or export records
```

---

## 📊 Records & Export

The Records page is designed as a small reporting area rather than just a list of certificates.

### Filter

Users can combine:

- Borrower / reference search
- Date From
- Date To
- Minimum value
- Maximum value
- Purity
- Sort order

### Export

The export controls use the selected date range and current record set to create a downloadable report.

```text
Records
   │
   ├── Date From ─────┐
   ├── Date To ───────┤
   ├── Other filters ─┤
   │                   ▼
   │              Filtered Records
   │                   │
   │          ┌────────┴────────┐
   │          ▼                 ▼
   │        CSV               Excel
   │
   └── View / Search / Sort / Details
```

This makes it useful for a shop operator who needs a report for a particular period without changing the stored records.

---

## 📁 Project structure

```text
.
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── RecordsPage.jsx
│   │   │   ├── MobileRecordsPage.jsx
│   │   │   ├── RecordDetailPage.jsx
│   │   │   └── DueSettlementPage.jsx
│   │   ├── utils/
│   │   │   ├── calculations.js
│   │   │   ├── pdfGenerator.js
│   │   │   ├── numberToWordsIndian.js
│   │   │   └── config.js
│   │   └── App.jsx
│   └── package.json
│
├── server/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── db.js
│   │   └── server.js
│   ├── scripts/
│   │   └── backup-to-google-drive.mjs
│   └── package.json
│
├── .github/workflows/
├── docker-compose.yml
├── render.yaml
├── vercel.json
├── Architecture.md
├── Design.md
└── Readme.md
```

---

## 🚀 Run locally

### 1. Start PostgreSQL

```bash
docker compose up -d postgres
```

### 2. Start the backend

```bash
cd server
npm ci
npm start
```

Create `server/.env` from `server/.env.example`.

### 3. Start the frontend

```bash
cd client
npm ci
npm run dev
```

If the API is not running at the default local address, configure `VITE_API_URL` in `client/.env`.

---

## ☁️ Deployment

### Frontend — Vercel

The root `vercel.json` configures the frontend build from `client/` and supports React Router routes.

```text
VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api
```

### Backend + Database — Render

The repository includes `render.yaml` for the API and PostgreSQL deployment.

```text
CLIENT_ORIGIN=https://YOUR-VERCEL-DOMAIN
CLOUDINARY_URL=cloudinary://...
```

`DATABASE_URL` is provided by the Render database connection.

Health check:

```text
https://YOUR-RENDER-SERVICE.onrender.com/api/health
```

Expected:

```json
{"ok":true}
```

---

## 🔐 Data & production approach

- PostgreSQL is the source of truth for saved certificates.
- The certificate `payload` stores the saved form, rates, rows, custom columns, totals and summaries.
- Real service credentials are kept in environment variables/secrets and are not committed.
- Cloudinary should be used for durable production image storage instead of relying on an ephemeral local filesystem.
- Automated PostgreSQL backups run through GitHub Actions.

<details>
<summary><strong>🔍 Current limitations / future improvements</strong></summary>

These are intentionally kept as future hardening work rather than adding unnecessary complexity now:

- Shared persistent shop-level rate configuration
- Authentication and authorization for multi-user deployment
- Server-side calculation validation/recalculation
- Pagination and server-side filtering beyond the current record-list limit
- A clear production policy preventing local filesystem image storage from being used as durable storage

</details>

---

## 📌 Project philosophy

**Build the useful thing first, keep the architecture understandable, and add complexity only when the product actually needs it.**

The application is intentionally structured so each major responsibility has a clear place: React for the UI, Express for the API, PostgreSQL for persistence, utilities for calculations/PDF generation, and external services only for storage, deployment, and backup concerns.

---

## 📚 More technical notes

For a deeper technical breakdown, see:

- [`Architecture.md`](./Architecture.md) — architecture, data model and business rules
- [`Design.md`](./Design.md) — design decisions
- [`Phases.md`](./Phases.md) — implementation phases

---

## 👨‍💻 Project

**Kanhaiya Gold — SBI Gold Appraiser Certificate**

Built as a practical full-stack application focused on replacing a manual certificate workflow with a searchable, persistent and recoverable digital workflow.
