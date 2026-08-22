# Architecture & Tech Stack

## Current Stack
- **Frontend:** React 19, Vite, Tailwind CSS, React Router.
- **PDF:** `jspdf` + `jspdf-autotable`.
- **Backend:** Node.js + Express.
- **Database:** PostgreSQL via `pg`.
- **Image storage:** Cloudinary when configured; local filesystem fallback for development.
- **QR:** `qrcode` generated in the browser from the uploaded gold-item image URL.
- **Deployment target:** Vercel for the frontend and Render (or another Node host) for the backend.

## Product Flow
```text
Dashboard
  -> enter shop / borrower / appraisal data
  -> calculate row market values
  -> calculate totals
  -> dynamically group purity summaries
  -> save certificate to PostgreSQL
  -> generate / share SBI-style PDF

Dashboard -> upload gold image -> backend -> Cloudinary/local storage -> image URL -> QR code -> saved certificate

Records -> server-side borrower/ref search -> client-side date/value/purity filters -> Record Details -> regenerate PDF
```

## Source of Truth
- **Saved certificates:** PostgreSQL is the source of truth.
- **Shop settings:** currently persisted in browser `localStorage` and copied into a certificate payload when the certificate is saved.
- **Certificate snapshot:** the `payload` JSONB column stores the complete form/rates/rows/custom-columns/totals/summaries needed to reopen and regenerate the certificate exactly as saved.
- **Calculated values:** the frontend derives market value, totals, summaries and amount-in-words before saving. The backend currently stores the supplied snapshot rather than recomputing the business calculations.

## Data Model
The main table is `certificates`:

```text
id UUID
borrower_name TEXT
ref_no TEXT
certificate_date DATE
item_image_url TEXT
total_market_value NUMERIC(14,2)
payload JSONB
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

Relational columns are kept for common search/listing needs; `payload` keeps the flexible certificate structure, including custom columns.

## Business Rules
1. Market value is normally `Net Weight × Rate for selected Purity`.
2. The UI currently supports a **manual market-value override per row**. Resetting the override returns the row to formula-based calculation.
3. Purity summaries are always derived from the purities actually present in appraisal rows; the PDF must not hardcode a fixed set such as only 18 Ct / 20 Ct.
4. Amount-in-words uses the Indian numbering system (Crore/Lakh/Thousand) and ends with `Only`.
5. Rates are currently held in Dashboard state and are saved only as part of an individual certificate snapshot; they are not yet a separate shared shop-level configuration.
6. A PDF generation action first attempts to save the current valid certificate snapshot, then renders the PDF from the same in-memory state.
7. Record listing is limited to the latest 100 API results; search by borrower/ref is handled by the backend, while additional date/value/purity filters are applied in the browser.
8. Uploaded image URLs are stored with the certificate. QR codes point to the image URL so the physical certificate can reference the uploaded item photo.

## Folder Structure
```text
/
├── client/
│   ├── src/
│   │   ├── pages/          # Dashboard, Records, Record Details
│   │   ├── utils/          # calculations, number-to-words, PDF, API config
│   │   └── App.jsx
│   └── package.json
└── server/
    ├── src/
    │   ├── controllers/    # certificate and upload business logic
    │   ├── routes/         # REST endpoints
    │   ├── db.js            # PostgreSQL initialization/pool
    │   └── server.js
    └── package.json
```

## Important Constraints
- Keep the application desktop-first because it is designed for shop-counter use.
- Avoid unnecessary state-management libraries; React state/hooks are sufficient for the current scope.
- Keep calculation logic separate from presentation code.
- Treat PDF layout as a separate rendering layer; do not make the PDF depend on DOM layout.
- Preserve Unicode/Hindi compatibility for shop and certificate text.

## Known Product Gaps to Resolve Later
- Shared/persistent shop-level rate configuration across devices.
- Authentication/authorization for real multi-user deployment.
- Server-side validation/recalculation of certificate financial totals.
- Pagination and server-side filtering beyond the current 100-record list limit.
- Clear production policy for image-storage fallback; local filesystem storage should not be treated as durable storage on ephemeral hosting.
