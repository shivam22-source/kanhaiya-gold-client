# Project Memory

## Current Status
The application has moved well beyond the original planning stage. The current implementation includes the React certificate builder, PDF generation, PostgreSQL persistence, records/search, record details, image upload and QR generation.

## Product Definition
The product is an SBI Gold Loan Appraiser Certificate Generator for jewellery shops/appraisers. Its core job is to turn appraisal inputs into a validated, repeatable certificate workflow and an SBI-style PDF while preserving past certificates for retrieval.

## Important Business Rules
- Purity summaries must be derived from the actual appraisal rows; never hardcode only 18 Ct / 20 Ct.
- Market value normally equals Net Weight × rate for the selected purity.
- Per-row manual market-value override exists and can be reset to formula calculation.
- Indian numbering system (Crore/Lakh/Thousand) is used for amount-in-words, ending with `Only`.
- Certificate data is persisted as a snapshot in PostgreSQL JSONB.
- Shop settings currently persist locally in the browser and are copied into certificate snapshots.
- Gold-item images are uploaded through the backend; Cloudinary is preferred when configured.

## Current Architecture
- Frontend: React 19 + Vite + Tailwind + React Router.
- Backend: Node.js + Express.
- Database: PostgreSQL (`pg`).
- PDF: jsPDF + AutoTable.
- Image upload: Multer + Cloudinary/local fallback.
- QR: browser-generated QR pointing to the stored image URL.

## Known Gaps / Next Priorities
1. Server-side validation/recalculation of financial values.
2. Certificate update/version semantics so repeated saves do not unintentionally create duplicates.
3. Shared shop-level rate/settings storage.
4. Authentication/authorization for production use.
5. Server-side pagination/filtering for records.
6. Production-safe image storage policy.
7. Automated tests for calculation and API behavior.

## Engineering Principle
Prefer boring, reliable behavior over feature bloat. The application is used for financial appraisal paperwork, so correctness, traceability, recoverability and predictable PDF output matter more than adding flashy features.
