# Architecture & Tech Stack

## Tech Stack
- **Frontend**: React 19, Vite, Tailwind CSS.
- **PDF Generation**: `jspdf` and `jspdf-autotable`.
- **Backend (Phase 4 / Stretch)**: Node.js, Express.js.
- **Database (Phase 4 / Stretch)**: MongoDB + Mongoose.
- **Deployment**: Vercel (Frontend), Render (Backend).

## Folder Structure
```text
/
├── client/                 # Frontend React App (Vite)
│   ├── src/
│   │   ├── components/     # UI Components (Form fields, Table, Previews)
│   │   ├── utils/          # calculations.js, numberToWords.js, pdfGenerator.js
│   │   ├── hooks/          # Custom state management
│   │   ├── assets/         # Fonts (NotoSansDevanagari)
│   │   └── App.jsx
│   └── package.json
└── server/                 # Backend Node/Express (Optional later phase)
    ├── models/             # Mongoose schemas (Certificate, Shop)
    ├── routes/             # API endpoints
    ├── controllers/        
    └── package.json

    ---

### `3. Rules.md` (AI & Coding Boundaries)
```markdown
# Development Rules & Constraints

## 1. Libraries and Tools
- **Must use**: React 19, Tailwind CSS, `jspdf`, `jspdf-autotable`.
- **Avoid**: Heavy component libraries (like MUI/AntD). Stick to native HTML elements styled with Tailwind for complete control.
- **State**: Use React's native `useState`, `useMemo`, and `useEffect`. No Redux needed.

## 2. Calculation Strictness (The "No Hardcoding" Rule)
- **Purity Summaries**: Do NOT hardcode "18 Ct" or "20 Ct". You must extract distinct purities from the table `rows` state, group them, and map them dynamically to generate the summary table headers and values.
- **Math precision**: Ensure floating-point math uses `.toFixed(2)` where appropriate to avoid Javascript rounding errors (e.g., `14.99 + 29.44`).
- **Test Data compliance**: The app's logic must natively produce the exact test data results provided in the prompt (e.g., "Fifteen Lakh Eighty-nine Thousand Two Hundred Eighty-seven Only").

## 3. PDF Layout Accuracy
- The PDF must look like the provided physical screenshot.
- Declaration paragraphs must be rendered as justified text blocks wrapping dynamic form variables, NOT as table cells.
- Real blank space must be left above signature labels for physical signing.
- Always embed a Unicode font (e.g., Noto Sans) into jsPDF to prevent blank squares for special/Hindi characters.

## 4. Layout
- Desktop-first layout, as it will be used at shop counters.
- Provide a persistent live preview of totals so users don't have to generate a PDF to check their math.