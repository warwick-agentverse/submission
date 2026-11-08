import React from 'react';
import { X, Upload, Check } from 'lucide-react';
import { IngestionBatchPreset } from '../utils/taxEngine';

interface RawDataPreviewModalProps {
  batch: IngestionBatchPreset | null;
  onClose: () => void;
  onIngestBatch: (batchId: string) => void;
}

const RAW_PREVIEW_SAMPLES: Record<
  string,
  { format: string; headers: string[]; rows: string[][]; rawSnippet: string }
> = {
  'batch-bank-q4': {
    format: 'CSV Bank Statement (Barclays Business)',
    headers: ['Date', 'Type', 'Merchant / Narrative', 'Out (£)', 'In (£)', 'Balance (£)'],
    rows: [
      ['02/11/2026', 'FEE', 'STRIPE UK PROCESSING & FX FEES', '940.00', '—', '18,420.50'],
      ['30/10/2026', 'BGC', 'CLIENT INVOICE #114 — ACME RETAIL', '—', '4,200.00', '19,360.50'],
      ['28/10/2026', 'DEB', 'MAVEN / COURSERA AI CONSULTING COHORT', '950.00', '—', '15,160.50'],
      ['24/10/2026', 'DEB', 'SAINSBURYS SUPERMARKET LOCAL (PERSONAL)', '64.20', '—', '16,110.50'],
      ['15/10/2026', 'DD', 'OCTOPUS ENERGY HOME DIRECT DEBIT', '210.00', '—', '16,174.70'],
    ],
    rawSnippet: `2026-11-02,FEE,"STRIPE UK PROCESSING & FX FEES",-940.00,18420.50\n2026-10-30,BGC,"CLIENT INVOICE #114 - ACME RETAIL",4200.00,19360.50\n2026-10-28,DEB,"MAVEN / COURSERA AI CONSULTING COHORT",-950.00,15160.50`,
  },
  'batch-receipts-camera': {
    format: 'OCR Scanned Receipts Bundle (PDF / JPG)',
    headers: ['File Name', 'Date', 'Merchant', 'Extracted Line Items', 'VAT (£)', 'Total (£)'],
    rows: [
      [
        'lner_tickets.pdf',
        '25/10/2026',
        'LNER & GWR Rail',
        '4x Return Rail Tickets (London ↔ Leeds/Bristol)',
        '0.00',
        '680.00',
      ],
      [
        'john_lewis_991.pdf',
        '19/10/2026',
        'John Lewis & Partners',
        'Sony WH-1000XM5 + Shure MV7 USB Podcasting Mic',
        '106.67',
        '640.00',
      ],
      [
        'pret_coffee.jpg',
        '18/10/2026',
        'Pret A Manger',
        '2x Flat White (Local commute — auto-ignored)',
        '1.20',
        '7.40',
      ],
    ],
    rawSnippet: `[OCR CONFIDENCE 99.4%] MERCHANT: JOHN LEWIS PLC | VAT REG: GB 232 4572 80\nITEM 1: SONY WH1000XM5 BLK £319.00 | ITEM 2: SHURE MV7 STUDIO MIC £321.00 | TOTAL: £640.00`,
  },
  'batch-invoices-sub': {
    format: 'PDF Supplier Invoices',
    headers: ['Invoice #', 'Date', 'Supplier', 'Service Description', 'Net (£)', 'Total (£)'],
    rows: [
      [
        'HJ-8821',
        '11/10/2026',
        'Harper James Solicitors',
        'Drafting Client Master Services Agreement & IP Clause',
        '1,350.00',
        '1,620.00',
      ],
      [
        'SK-409',
        '04/08/2026',
        'Studio Kinetix Ltd',
        'Subcontractor UI Motion Design Deliverable',
        '2,450.00',
        '2,450.00',
      ],
    ],
    rawSnippet: `INVOICE #HJ-8821 | HARPER JAMES SOLICITORS LLP | TO: SOLE TRADER CONSULTANCY\nDESCRIPTION: Commercial MSA & Client IP Assignment Review | TOTAL DUE: £1,620.00`,
  },
  'batch-mileage-q4': {
    format: 'GPS Mileage Log (CSV / Timeline JSON)',
    headers: ['Date', 'Origin → Destination', 'Purpose Tag', 'Distance', 'Rate', 'Claim (£)'],
    rows: [
      [
        '01/11/2026',
        'Home Office (SW11) → Regional Client Sites',
        'Client Workshops (14 trips)',
        '940 mi',
        '45p/mi',
        '423.00',
      ],
      [
        '27/10/2026',
        'Heathrow Terminal 5 Short Stay Parking',
        'Dublin Client Conference (4 days)',
        '—',
        'Receipt',
        '215.00',
      ],
    ],
    rawSnippet: `{"trip_id":"gps_904","date":"2026-11-01","miles":940,"hmrc_rate":0.45,"deductible_gbp":423.00}\n{"trip_id":"lhr_t5","date":"2026-10-27","parking_gbp":215.00,"note":"Supplemental to 45p/mi"}`,
  },
};

export const RawDataPreviewModal: React.FC<RawDataPreviewModalProps> = ({
  batch,
  onClose,
  onIngestBatch,
}) => {
  if (!batch) return null;

  const preview = RAW_PREVIEW_SAMPLES[batch.id];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="raw-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
    >
      <div className="bg-white border border-slate-200 rounded-lg max-w-3xl w-full p-6 shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-200">
          <div>
            <p className="text-xs font-mono text-slate-500">
              {batch.fileName} · {preview?.format}
            </p>
            <h2 id="raw-preview-title" className="text-base font-bold text-slate-900 mt-0.5">
              Raw Source Preview: {batch.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close raw data preview"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {preview && (
          <>
            <div className="overflow-x-auto border border-slate-200 rounded-md">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    {preview.headers.map((h) => (
                      <th key={h} className="py-2 px-3 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {preview.rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="py-2 px-3 text-slate-800 whitespace-nowrap">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-900 text-slate-200 p-3 rounded-md font-mono text-xs overflow-x-auto">
              <div className="text-slate-400 text-[11px] mb-1">Raw File Payload Snippet:</div>
              <pre className="leading-relaxed">{preview.rawSnippet}</pre>
            </div>
          </>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          <span className="text-xs text-slate-500">
            Est. Tax Saving:{' '}
            <strong className="font-mono text-emerald-700">
              +£{batch.potentialTaxSaving.toLocaleString()}
            </strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
            >
              Close
            </button>
            {batch.ingested ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md">
                <Check className="w-3.5 h-3.5 text-emerald-700" />
                Already Uploaded
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onIngestBatch(batch.id);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload & Extract (+£{batch.potentialTaxSaving.toLocaleString()})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
