# Taximiser

**UK Sole Trader Tax & Self Assessment (`SA103F`) Optimiser**

Most UK sole traders, freelancers, and small businesses overpay thousands of pounds in tax every year—not because they lack deductible expenses, but because they do not know the full breadth of HMRC statutory reliefs, allowances, and apportionment rules (`ITTOIA 2005`, `CAA 2001`, `HS222`, and `BIM` manuals) or cannot afford a specialist Chartered Tax Adviser to comb through every receipt.

**Taximiser** bridges that knowledge gap. Because our AI and deterministic HMRC rule engine possess deeper knowledge of UK tax legislation than an everyday sole trader, the platform continuously analyses bank statements, foreign-currency receipts, invoices, and mileage logs to uncover every legitimate tax relief and deduction the user can take advantage of—maximising their tax savings while producing a compliant, ready-to-file `Form SA103F` return.

---

## Core Workflow

1. **Upload & Classify (`1. Upload`)** — Ingest CSV bank statements, camera receipts, invoices, or GPS mileage logs. Foreign-currency receipts (e.g. `HKD`, `USD`, `EUR`) are converted to `GBP (£)` using live exchange rates. During upload, users classify mixed items as **Work**, **Custom % Split**, or **Personal**, or select individual lines on an **itemised receipt**.
2. **Review & Attach Proof (`2. Splits`)** — Refine business-use percentages, inspect fuel residence/trip telemetry, and attach supporting VAT invoices into `/evidence_justifications/`.
3. **Uncover HMRC Tax Reliefs (`3. Reliefs`)** — Automatically surface high-value UK tax reliefs and subsidies most sole traders miss (`HMRC BIM47820` proportional home office, `BIM46351` pre-trading equipment up to 7 years prior, `CAA 2001` 100% Annual Investment Allowance, and pension tax-band extensions), each linked directly to official `GOV.UK` guidance.
4. **Verify & Export (`4. Ledger` & `Export SA103`)** — Inspect the decision trace (`Why?`) for any transaction, run the Second Bot & Chartered Accountant sign-off check, and export an official HMRC `Form SA103F` PDF, HTML, or CSV schedule.

---

## Architecture: Deep Regulatory Knowledge + Deterministic Maths

Taximiser pairs regulatory discovery with strict deterministic arithmetic:

- **AI Regulatory Discovery (`Gemini 3.8 Flash` & `Gemini 4 Argon`)**: Performs multimodal OCR on receipts and invoices, identifies foreign currencies and itemised bill lines, matches spending patterns against lesser-known HMRC reliefs, and traverses the expert (`HS222` / `BIM`) decision tree to ask targeted clarification questions. The AI never computes tax liabilities.
- **Deterministic Code Engine (`src/utils/taxEngine.ts` + Python `decimal`)**:
  - **Hard-Coded Statutory Guardrails**: Automatically blocks non-deductible claims (such as client entertaining under `ITTOIA 2005 s.45`, client gifts over `£50` under `s.47`, or everyday clothing under *Mallalieu v Drummond*) to `£0`, and caps unverified high-risk dual-use items at `85%` until proof is attached.
  - **Forensic & Unseen Data Shield (`src/utils/unseenTestingEngine.ts`)**: Screens uploads against prompt-injection payloads, doctored receipt totals (`sum(lineItems) != total`), out-of-year dates, and split-transaction structuring across a 35-item synthetic and holdout benchmark suite.
  - **Reproducible 2025/26 UK Tax & Class 4 NI Formula**:
    - **Personal Allowance (`£0 – £12,570`)**: `0%`
    - **Basic Rate (`£12,570 – £50,270`)**: `20%` Income Tax + `6%` Class 4 NI = `26%` (`£9,802` full band)
    - **Higher Rate (`Above £50,270`)**: `40%` Income Tax + `2%` Class 4 NI = `42%`
    - For any taxable profit $P > £50,270$:
      $$\text{Total Tax \& NI} = \text{round}\big(9802 + (P - 50270) \times 0.42\big)$$

See [`ARCHITECTURE_FLOWCHART.md`](./ARCHITECTURE_FLOWCHART.md) for the full system pipeline diagram.

---

## Quick Start

```bash
# Run deterministic tax engine, SA103F, FX & forensic unit tests
npx tsx --test src/utils/taxEngine.test.ts

# Start full-stack Express + Vite server on port 3000
npm run dev
```
