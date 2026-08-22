# Implementation Roadmap

## Phase 1 — Core Certificate Builder
- [x] React + Vite + Tailwind setup
- [x] Shop settings with browser persistence
- [x] Borrower/reference/signature form
- [x] Dynamic appraisal rows
- [x] Custom columns
- [x] Purity-based rate calculation
- [x] Live totals
- [x] Dynamic purity summaries
- [x] Indian amount-to-words conversion

## Phase 2 — PDF & Media
- [x] SBI-style A4 PDF generation
- [x] Dynamic declaration text
- [x] Dynamic appraisal table and custom columns
- [x] Purity summary rendering
- [x] Gold-item image upload
- [x] QR code generation from image URL
- [x] PDF share/download fallback

## Phase 3 — Persistence & Records
- [x] Express API
- [x] PostgreSQL persistence
- [x] Certificate payload snapshots using JSONB
- [x] Certificate list/search
- [x] Record details page
- [x] PDF regeneration from saved record
- [x] Date/value/purity client-side filters

## Phase 4 — Production Hardening
- [ ] Move certificate calculations/validation to a trusted server-side layer
- [ ] Add authentication and authorization
- [ ] Add shared shop configuration and rate management
- [ ] Add server-side pagination and filtering
- [ ] Add safe certificate update/versioning semantics instead of treating every save as a new certificate
- [ ] Make image storage production-safe and remove reliance on local filesystem fallback in production
- [ ] Add automated tests for calculation, amount-to-words, API validation and PDF data mapping
- [ ] Add deployment/health monitoring and environment validation

## Product Rule
Do not add features merely because they are technically possible. Every new feature should reduce manual appraisal work, prevent certificate mistakes, improve record retrieval, or improve production reliability.
