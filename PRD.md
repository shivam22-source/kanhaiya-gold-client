# Project Requirements Document (PRD)

## Project Name
SBI Gold Loan Appraiser Certificate Generator

## Objective
To build a web application that allows gold appraisers and jewelry shops to easily fill out a form and generate a highly accurate, perfectly formatted "Gold Loan Appraiser Certificate" (Annexure: PL-61(i)) for the State Bank of India (SBI). 

## Target Audience
- Gold Appraisers
- Jewelry Shop Owners/Counter Staff operating on Desktop computers.

## Core Problem to Solve
Generating complex PDF certificates manually is error-prone. Calculating net weights, market values, dynamic grouping of purity summaries, and converting numbers to Indian format words manually is time-consuming. This app automates calculations and ensures exact compliance with the bank's formatting requirements.

## Key Features & Requirements
1. **Dynamic Data Entry Form**: Section-by-section input form mimicking the PDF flow.
2. **Shop Settings**: Save reusable header info (Shop Name, Address, A/c No, Footer credit).
3. **Dynamic Appraisal Table**: 
    - Add/delete rows.
    - Add custom custom column capability.
    - Auto-calculation: `Market Value = Net Weight × Rate`.
    - Live Totals.
4. **Dynamic Purity Summaries**: 
    - Auto-grouped Gross Weight and Net Weight summaries.
    - **CRITICAL**: Carat headers must *not* be hardcoded (e.g., just 18 Ct / 20 Ct). The table must dynamically generate columns based strictly on the unique purity values present in the appraisal table.
5. **Amount in Words Calculation**: Convert Indian numbering system (Crore, Lakh, Thousand) with "Only" at the end.
6. **PDF Generation**: 
    - jsPDF + autoTable to exactly replicate the SBI layout.
    - Justified text for declaration paragraphs.
    - Support for Devanagari/Hindi rendering if required (embed Unicode font).