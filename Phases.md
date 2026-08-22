# Implementation Phases

## Phase 1: Setup & UI Skeleton
- Initialize Vite + React 19 + Tailwind.
- Build the persistent "Shop Settings" panel (Local Storage).
- Build the basic form layout (Reference block, Borrower details, Signatures).

## Phase 2: Dynamic Core Data & Logic
- Implement the Appraiser Table with Add/Delete row logic.
- Implement the "Add Custom Column" feature.
- Build the Rate Settings panel (Editable rates per Carat).
- Implement Live Totals (Weight, Units, Market Value).
- **Critical Logic**: Implement dynamic Purity Grouping for Gross/Net summaries.
- Implement `numberToWordsIndian(num)` utility and bind to UI.

## Phase 3: PDF Generation (The Heavylift)
- Setup `jsPDF` with a Unicode font.
- Replicate the header, bank addressee, and dynamic declaration paragraph.
- Implement `jspdf-autotable` for the main item table and custom columns.
- Render dynamic purity summary tables side-by-side using autotable.
- Ensure the footer credit line ("Design & Developed by...") is placed perfectly at the bottom page bounds.

## Phase 4: Full Stack Integration (Optional/Stretch)
- Setup Express/MongoDB backend.
- Create endpoints: `POST /api/certificates` and `GET /api/certificates`.
- Add search/filter capabilities to find past borrower certificates.