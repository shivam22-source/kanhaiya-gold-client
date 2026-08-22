# Design Guidelines

## Visual Theme
- **Style**: Professional, clean, banking-standard utility UI. 
- **Colors**:
  - Background: `bg-slate-50`
  - Cards/Containers: `bg-white` with subtle `shadow-sm` and `border-slate-200`.
  - Primary Buttons: `bg-indigo-600 hover:bg-indigo-700 text-white`.
  - Text: `text-slate-800` for main content, `text-slate-500` for labels.
  - Table Headers: `bg-slate-100 font-semibold`.

## Typography
- **Web App UI**: `Inter` or standard Tailwind sans-serif.
- **PDF Export**: Must use a standard serif or clear sans-serif (e.g., Times / Helvetica equivalent in jsPDF), with Noto Sans Devanagari fallback embedded for custom characters. Title should be bold and underlined.

## Layout Structure
- **Left Panel / Top Section**: Data Entry Form (Settings -> Borrower -> Items -> Signatures).
- **Sticky / Bottom Section**: A "Live Calculations Board" showing dynamic totals, amount in words, and dynamically generated summary blocks so the appraiser can verify numbers instantly without scrolling.