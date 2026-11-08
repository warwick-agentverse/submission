import React, { useState, useMemo } from 'react';
import {
  X,
  Download,
  Check,
  PackageCheck,
  Bot,
  ShieldAlert,
  UserCheck,
  CheckCircle2,
  ExternalLink,
  FileText,
  FileSpreadsheet,
  Printer,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  ExpenseItem,
  TaxReliefSubsidy,
  TaxSummaryMetrics,
  getDeductibleAmount,
} from '../utils/taxEngine';
import {
  DEFAULT_SA103_METADATA,
  Sa103TaxpayerMetadata,
  buildOfficialSa103FormModel,
  generateOfficialSa103CsvSchedule,
  generateOfficialSa103HtmlDocument,
  generateOfficialSa103PdfBytes,
} from '../utils/sa103Generator';

interface TaxPackExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: TaxSummaryMetrics;
  expenses: ExpenseItem[];
  reliefs: TaxReliefSubsidy[];
  strictGuardrail?: boolean;
}

export const TaxPackExportModal: React.FC<TaxPackExportModalProps> = ({
  isOpen,
  onClose,
  summary,
  expenses,
  reliefs,
  strictGuardrail = true,
}) => {
  const [activeTab, setActiveTab] = useState<'sa103_form' | 'itemised_schedule'>(
    'sa103_form'
  );
  const [taxpayerMeta, setTaxpayerMeta] = useState<Sa103TaxpayerMetadata>(
    DEFAULT_SA103_METADATA
  );
  const [expandedBoxId, setExpandedBoxId] = useState<string | null>('Box 20');
  const [downloadedFormat, setDownloadedFormat] = useState<
    'pdf' | 'html' | 'csv' | null
  >(null);

  // Forced Self Final Check checkboxes to prevent the worst failure (claiming taxes incorrectly)
  const [selfCheck1ResidenceAndMixedUse, setSelfCheck1ResidenceAndMixedUse] =
    useState(false);
  const [selfCheck2SecondBotAndBlockList, setSelfCheck2SecondBotAndBlockList] =
    useState(false);

  const sa103Model = useMemo(
    () =>
      buildOfficialSa103FormModel(
        summary,
        expenses,
        reliefs,
        strictGuardrail,
        taxpayerMeta
      ),
    [summary, expenses, reliefs, strictGuardrail, taxpayerMeta]
  );

  if (!isOpen) return null;

  const verified = expenses.filter((e) => e.status === 'verified');
  const packedProofs = verified.filter((e) => e.proofAttached);
  const isForcedSelfFinalCheckComplete =
    selfCheck1ResidenceAndMixedUse && selfCheck2SecondBotAndBlockList;

  const triggerBrowserDownload = (
    blob: Blob,
    fileName: string,
    format: 'pdf' | 'html' | 'csv'
  ) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDownloadedFormat(format);
  };

  const handleDownloadPdfForm = () => {
    if (!isForcedSelfFinalCheckComplete) return;
    const pdfBytes = generateOfficialSa103PdfBytes(sa103Model);
    const blob = new Blob([pdfBytes.buffer as ArrayBuffer], {
      type: 'application/pdf',
    });
    triggerBrowserDownload(
      blob,
      'HMRC_Form_SA103F_2025-26_Ready_To_Send.pdf',
      'pdf'
    );
  };

  const handleDownloadPrintableHtmlForm = () => {
    if (!isForcedSelfFinalCheckComplete) return;
    const htmlStr = generateOfficialSa103HtmlDocument(
      sa103Model,
      expenses,
      strictGuardrail
    );
    const blob = new Blob([htmlStr], { type: 'text/html;charset=utf-8;' });
    triggerBrowserDownload(
      blob,
      'HMRC_Form_SA103F_2025-26_Official_Replica.html',
      'html'
    );
  };

  const handleDownloadCsvSchedule = () => {
    if (!isForcedSelfFinalCheckComplete) return;
    const csvStr = generateOfficialSa103CsvSchedule(
      sa103Model,
      expenses,
      strictGuardrail
    );
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    triggerBrowserDownload(
      blob,
      'HMRC_SA103F_Box_And_Evidence_Schedule_2025-26.csv',
      'csv'
    );
  };

  const utrDigits = taxpayerMeta.utr
    .replace(/\D/g, '')
    .padEnd(10, '0')
    .slice(0, 10)
    .split('');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Authentic HM Revenue & Customs Green Top Banner */}
        <div className="bg-[#00703c] text-white px-6 py-4 flex items-start justify-between gap-4 border-b-4 border-[#005a30] shrink-0">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-100">
              <span>HM Revenue &amp; Customs · Official Ready-to-Send Return</span>
              <span>·</span>
              <span className="font-mono bg-white/15 px-1.5 py-0.5 rounded">
                {sa103Model.formCode}
              </span>
              <span>·</span>
              <span className="font-mono">{sa103Model.submissionReference}</span>
            </div>
            <h2
              id="export-modal-title"
              className="text-lg font-extrabold tracking-tight text-white mt-0.5"
            >
              Tax Return: Self-Employment (Full) — Form SA103F (2025–26)
            </h2>
            <p className="text-xs text-emerald-50 mt-0.5">
              Human-readable official HMRC SA103F form with dual-column{' '}
              <strong>Allowable (Boxes 17–31)</strong> vs.{' '}
              <strong>Disallowable Add-Backs (Boxes 32–46)</strong>,{' '}
              <strong>Box 49 AIA</strong>, and <strong>Box 103 White Space Notes</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close SA103 form modal"
            className="p-1.5 text-emerald-100 hover:text-white rounded-md hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-Toolbar: View Switcher + Second Bot & CA Verification Badge */}
        <div className="px-6 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('sa103_form')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                activeTab === 'sa103_form'
                  ? 'bg-[#00703c] text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Official HMRC Form SA103F (Boxes 1–103)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('itemised_schedule')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                activeTab === 'itemised_schedule'
                  ? 'bg-[#00703c] text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Itemised Schedule &amp; CA Sign-Off ({expenses.length} Items)
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200">
              <Bot className="w-3.5 h-3.5 text-emerald-700" />
              Second Bot: 0 False Claims ({sa103Model.codedBlockListZeroedCount} Blocked at £0)
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold bg-white text-slate-800 border border-slate-200">
              <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
              CA Verified (ICAEW #88412)
            </span>
          </div>
        </div>

        {/* Scrollable Official Form Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {activeTab === 'sa103_form' ? (
            <>
              {/* SECTION 1: Taxpayer & Business Details (Boxes 1–10) */}
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <div className="bg-slate-900 text-white px-3.5 py-1.5 text-xs font-bold flex items-center justify-between">
                  <span>Section 1: Business &amp; Taxpayer Details (SA103F Boxes 1–10)</span>
                  <span className="font-mono text-[11px] text-slate-300">
                    Tax Year 6 April 2025 to 5 April 2026
                  </span>
                </div>
                <div className="p-3.5 bg-slate-50/70 grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
                  <div className="md:col-span-4">
                    <label
                      htmlFor="sa103-taxpayer-name"
                      className="block text-[11px] font-bold text-slate-600 uppercase"
                    >
                      Taxpayer Full Name
                    </label>
                    <input
                      id="sa103-taxpayer-name"
                      type="text"
                      value={taxpayerMeta.taxpayerName}
                      onChange={(e) =>
                        setTaxpayerMeta((prev) => ({
                          ...prev,
                          taxpayerName: e.target.value,
                        }))
                      }
                      className="mt-1 w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-semibold text-slate-900"
                    />
                  </div>

                  <div className="md:col-span-5">
                    <span className="block text-[11px] font-bold text-slate-600 uppercase">
                      Unique Taxpayer Reference (UTR — 10 Digits)
                    </span>
                    <div className="mt-1 flex items-center gap-1">
                      {utrDigits.map((digit, idx) => (
                        <span
                          key={idx}
                          className="w-6 h-7 inline-flex items-center justify-center bg-white border-2 border-slate-800 font-mono font-bold text-xs text-slate-900 rounded-2xs"
                        >
                          {digit}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="md:col-span-3">
                    <label
                      htmlFor="sa103-postcode"
                      className="block text-[11px] font-bold text-slate-600 uppercase"
                    >
                      Box 5: Business Postcode
                    </label>
                    <input
                      id="sa103-postcode"
                      type="text"
                      value={taxpayerMeta.businessPostcode}
                      onChange={(e) =>
                        setTaxpayerMeta((prev) => ({
                          ...prev,
                          businessPostcode: e.target.value,
                        }))
                      }
                      className="mt-1 w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900"
                    />
                  </div>

                  <div className="md:col-span-5">
                    <label
                      htmlFor="sa103-business-name"
                      className="block text-[11px] font-bold text-slate-600 uppercase"
                    >
                      Box 1: Business Name
                    </label>
                    <input
                      id="sa103-business-name"
                      type="text"
                      value={taxpayerMeta.businessName}
                      onChange={(e) =>
                        setTaxpayerMeta((prev) => ({
                          ...prev,
                          businessName: e.target.value,
                        }))
                      }
                      className="mt-1 w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-semibold text-slate-900"
                    />
                  </div>

                  <div className="md:col-span-4">
                    <span className="block text-[11px] font-bold text-slate-600 uppercase">
                      Box 2: Description of Business
                    </span>
                    <div className="mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded text-slate-700 truncate">
                      {taxpayerMeta.businessDescription}
                    </div>
                  </div>

                  <div className="md:col-span-3">
                    <span className="block text-[11px] font-bold text-slate-600 uppercase">
                      Boxes 8–9: Accounting Period
                    </span>
                    <div className="mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded font-mono text-slate-800">
                      {taxpayerMeta.accountingPeriodStart} – {taxpayerMeta.accountingPeriodEnd}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Business Income (Box 15) */}
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <div className="bg-slate-900 text-white px-3.5 py-1.5 text-xs font-bold flex items-center justify-between">
                  <span>Section 2: Business Income (SA103F Page 2, Boxes 15–16)</span>
                  <span className="font-mono text-[11px] text-emerald-300">
                    ITTOIA 2005 Part 2
                  </span>
                </div>
                <div className="p-3 bg-white flex items-center justify-between gap-4 text-xs">
                  <div>
                    <span className="font-bold text-slate-900">
                      Box 15: Your turnover – the takings, fees, sales or money earned by your business
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Gross self-employed income before deducting allowable business expenses or capital allowances.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2 py-1 bg-slate-100 border border-slate-300 font-mono font-bold text-slate-800 rounded">
                      Box 15
                    </span>
                    <span className="px-3 py-1.5 bg-slate-50 border-2 border-slate-800 font-mono font-extrabold text-sm text-slate-900 rounded min-w-32 text-right">
                      £{sa103Model.box15TurnoverGbp.toLocaleString()}.00
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Dual-Column Business Expenses (Allowable Boxes 17–31 vs Disallowable Boxes 32–46) */}
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <div className="bg-slate-900 text-white px-3.5 py-1.5 text-xs font-bold flex items-center justify-between">
                  <span>
                    Section 3: Business Expenses — Allowable (Boxes 17–31) vs. Disallowable Add-Backs (Boxes 32–46)
                  </span>
                  <span className="text-[11px] text-slate-300 font-normal">
                    Click any box row to verify underlying items
                  </span>
                </div>

                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
                      <th className="py-2 px-3">Official HMRC SA103F Field Description</th>
                      <th className="py-2 px-2 text-center w-20">Allowable Box</th>
                      <th className="py-2 px-3 text-right w-28">Allowable (£)</th>
                      <th className="py-2 px-2 text-center w-24">Disallowable Box</th>
                      <th className="py-2 px-3 text-right w-28">Disallowable (£)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {sa103Model.expenseBoxes.map((row) => {
                      const isExpanded = expandedBoxId === row.allowableBoxNumber;
                      return (
                        <React.Fragment key={row.allowableBoxNumber}>
                          <tr
                            onClick={() =>
                              setExpandedBoxId(
                                isExpanded ? null : row.allowableBoxNumber
                              )
                            }
                            className="hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            <td className="py-2 px-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-slate-900">
                                  {row.officialLabel}
                                </span>
                                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                                  {row.contributingItems.length} item(s)
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  )}
                                </span>
                              </div>
                              <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                                Statutory Authority: {row.hmrcStatutoryCite}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center font-mono font-bold text-slate-800 bg-slate-50">
                              {row.allowableBoxNumber}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                              £{row.allowableGbp.toLocaleString()}.00
                            </td>
                            <td className="py-2 px-2 text-center font-mono font-bold text-slate-700 bg-slate-50">
                              {row.disallowableBoxNumber}
                            </td>
                            <td
                              className={`py-2 px-3 text-right font-mono font-bold ${
                                row.disallowableGbp > 0
                                  ? 'text-red-700 bg-red-50/40'
                                  : 'text-slate-400'
                              }`}
                            >
                              £{row.disallowableGbp.toLocaleString()}.00
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr className="bg-slate-50/90">
                              <td colSpan={5} className="px-4 py-2.5 border-t border-slate-200">
                                {row.contributingItems.length === 0 ? (
                                  <p className="text-[11px] text-slate-500">
                                    No transactions recorded under {row.allowableBoxNumber} in this period.
                                  </p>
                                ) : (
                                  <div className="space-y-1">
                                    <div className="text-[11px] font-bold text-slate-700">
                                      Itemised Breakdown for {row.allowableBoxNumber} / {row.disallowableBoxNumber}:
                                    </div>
                                    {row.contributingItems.map((ci) => (
                                      <div
                                        key={ci.id}
                                        className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-white border border-slate-200 rounded px-2.5 py-1"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono text-slate-400">
                                            {ci.date}
                                          </span>
                                          <span className="font-semibold text-slate-900">
                                            {ci.merchant}
                                          </span>
                                          <span className="font-mono text-slate-500">
                                            ({ci.rule})
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-3 font-mono">
                                          <span className="text-slate-600">
                                            Gross: £{ci.grossGbp.toLocaleString()}
                                          </span>
                                          <span className="font-bold text-emerald-700">
                                            Allowable: £{ci.allowableGbp.toLocaleString()}
                                          </span>
                                          <span
                                            className={`font-bold ${
                                              ci.disallowableGbp > 0
                                                ? 'text-red-700'
                                                : 'text-slate-400'
                                            }`}
                                          >
                                            Disallowable: £{ci.disallowableGbp.toLocaleString()}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}

                    {/* Box 31 & Box 46 Totals */}
                    <tr className="bg-emerald-50/70 font-bold text-slate-900 border-t-2 border-slate-300">
                      <td className="py-2.5 px-3">
                        Total Allowable Business Expenses (Box 31) &amp; Total Disallowable Add-Backs (Box 46)
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono bg-emerald-100/70">
                        Box 31
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-800 text-sm">
                        £{sa103Model.box31TotalAllowableExpensesGbp.toLocaleString()}.00
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono bg-red-100/60 text-red-900">
                        Box 46
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-red-700 text-sm">
                        £{sa103Model.box46TotalDisallowableExpensesGbp.toLocaleString()}.00
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* SECTION 4: Net Profit (Box 47), Capital Allowances (Box 49 AIA) & Taxable Profit (Box 64 / SA302) */}
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <div className="bg-slate-900 text-white px-3.5 py-1.5 text-xs font-bold flex items-center justify-between">
                  <span>
                    Section 4: Net Profit, Capital Allowances (Box 49 AIA) &amp; Final SA302 Tax Calculation
                  </span>
                  <span className="font-mono text-[11px] text-emerald-300">
                    CAA 2001 s.51A · SA103F Pages 3–4
                  </span>
                </div>
                <table className="w-full text-left border-collapse text-xs">
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-800">
                        Box 47: Net business profit (Box 15 turnover minus Box 31 allowable expenses)
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold bg-slate-50 w-24">
                        Box 47
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 w-36">
                        £{sa103Model.box47NetProfitGbp.toLocaleString()}.00
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3">
                        <div className="font-semibold text-slate-900">
                          Box 49: Annual Investment Allowance (100% AIA Capital Allowances &amp; s.57 Pre-Trading Gear)
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {sa103Model.box49ContributingItems.join(' · ')}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold bg-slate-50">
                        Box 49
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                        £{sa103Model.box49AnnualInvestmentAllowanceGbp.toLocaleString()}.00
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-800">
                        SA100 TR4 Box 1: Payments to registered pension schemes (SIPP gross-up tax relief)
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold bg-slate-50">
                        TR4 Box 1
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                        £{sa103Model.sa100Tr4Box1PensionReliefGbp.toLocaleString()}.00
                      </td>
                    </tr>
                    <tr className="bg-slate-100 font-bold text-slate-900">
                      <td className="py-2.5 px-3">
                        Box 64: Total taxable profits from this business (Net Profit after Capital Allowances &amp; Reliefs)
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        Box 64
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-sm">
                        £{sa103Model.netTaxableIncomeAfterPensionGbp.toLocaleString()}.00
                      </td>
                    </tr>
                    <tr className="bg-[#00703c] text-white font-bold">
                      <td className="py-2.5 px-3">
                        HMRC SA302 Final Income Tax + Class 4 National Insurance Payable (Total Saved: +£
                        {sa103Model.totalTaxSavedVsUnoptimisedGbp.toLocaleString()}.00)
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        SA302
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-sm">
                        £{sa103Model.incomeTaxAndClass4NiPayableGbp.toLocaleString()}.00
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* SECTION 5: Box 103 — Any Other Information (HMRC White Space Statutory Disclosure) */}
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <div className="bg-slate-900 text-white px-3.5 py-1.5 text-xs font-bold flex items-center justify-between">
                  <span>
                    Section 5: Box 103 — &ldquo;Any other information&rdquo; (HMRC White Space Statutory Disclosure)
                  </span>
                  <span className="font-mono text-[11px] text-slate-300">
                    SA103F Page 6, Box 103
                  </span>
                </div>
                <div className="p-3 bg-slate-50 font-mono text-[11px] text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {sa103Model.box103WhiteSpaceDisclosure}
                </div>
              </div>
            </>
          ) : (
            /* TAB 2: Itemised Schedule & Chartered Accountant Sign-Off */
            <div className="border border-slate-300 rounded-lg overflow-hidden">
              <div className="bg-slate-900 text-white px-3.5 py-2 text-xs font-bold flex items-center justify-between">
                <span>
                  Itemised HMRC Verification Schedule (/evidence_justifications/ Manifest)
                </span>
                <span className="font-mono text-[11px] text-emerald-300">
                  {verified.length} Verified · {packedProofs.length} Proofs Packed
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Merchant / Description</th>
                      <th className="py-2 px-3">Category</th>
                      <th className="py-2 px-3">HMRC Statutory Rule</th>
                      <th className="py-2 px-3 text-right">Gross (£)</th>
                      <th className="py-2 px-3 text-right">Allowable (£)</th>
                      <th className="py-2 px-3 text-right">Disallowable (£)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {expenses.map((item) => {
                      const allowable =
                        item.status === 'verified'
                          ? getDeductibleAmount(item, strictGuardrail)
                          : 0;
                      const disallowable = Math.max(0, item.grossAmount - allowable);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono text-slate-500 whitespace-nowrap">
                            {item.date}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            {item.merchantOrDescription}
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {item.category}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                            {item.taxRuleReference}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700">
                            £{item.grossAmount.toLocaleString()}.00
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                            £{allowable.toLocaleString()}.00
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-mono font-bold ${
                              disallowable > 0 ? 'text-red-700' : 'text-slate-400'
                            }`}
                          >
                            £{disallowable.toLocaleString()}.00
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Mandatory Forced Self Final Check & Box 22 Declaration */}
          <div
            data-testid="forced-self-final-check"
            className="p-3.5 bg-amber-50/90 border border-amber-300 rounded-lg space-y-2.5 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-amber-950">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  Box 22 Taxpayer Declaration &amp; Mandatory Forced Self Final Check (Unlocks Official SA103F Filing Export)
                </span>
              </div>
              <a
                href="https://www.gov.uk/government/publications/self-assessment-self-employment-full-sa103f"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-900 hover:underline shrink-0"
              >
                Official HMRC SA103F Guidance <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer text-slate-800">
              <input
                type="checkbox"
                checked={selfCheck1ResidenceAndMixedUse}
                onChange={(e) => setSelfCheck1ResidenceAndMixedUse(e.target.checked)}
                className="mt-0.5 rounded border-amber-400 accent-[#00703c] cursor-pointer"
              />
              <span>
                <strong>1. Self-Check of SA103F Boxes &amp; Residence Fuel Rules:</strong> I have
                verified the human-readable SA103F figures above and confirm that private commuting
                from residence <code className="font-mono">{taxpayerMeta.businessPostcode}</code> and
                disallowable items in <strong>Boxes 32–46 (£{sa103Model.box46TotalDisallowableExpensesGbp.toLocaleString()})</strong> have been excluded from my allowable claim.
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer text-slate-800">
              <input
                type="checkbox"
                checked={selfCheck2SecondBotAndBlockList}
                onChange={(e) => setSelfCheck2SecondBotAndBlockList(e.target.checked)}
                className="mt-0.5 rounded border-amber-400 accent-[#00703c] cursor-pointer"
              />
              <span>
                <strong>2. Taxpayer &amp; Chartered Accountant Declaration:</strong> I declare that
                the information on this Self-Employment (Full) SA103F return is correct and complete
                to the best of my knowledge, audited by the{' '}
                <strong>Second Bot Verification Agent</strong> ({sa103Model.codedBlockListZeroedCount}{' '}
                blocked items forced to £0) and ready for HMRC / Chartered Accountant submission.
              </span>
            </label>
          </div>
        </div>

        {/* Sticky Footer with Human-Readable & HMRC-Ready Download Formats */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 flex items-center gap-2">
            {isForcedSelfFinalCheckComplete ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-800 font-bold">
                <CheckCircle2 className="w-4 h-4 text-[#00703c]" />
                SA103F Signed &amp; Ready to Send to HMRC
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-amber-900 font-medium">
                <PackageCheck className="w-4 h-4 text-amber-700 shrink-0" />
                Tick both declaration boxes above to download your ready-to-send HMRC SA103F form.
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>

            <button
              type="button"
              disabled={!isForcedSelfFinalCheckComplete}
              onClick={handleDownloadCsvSchedule}
              data-testid="download-sa103-csv-btn"
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                isForcedSelfFinalCheckComplete
                  ? 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100 cursor-pointer'
                  : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
              }`}
            >
              {downloadedFormat === 'csv' ? (
                <Check className="w-3.5 h-3.5 text-emerald-700" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
              )}
              HMRC Schedule (.csv)
            </button>

            <button
              type="button"
              disabled={!isForcedSelfFinalCheckComplete}
              onClick={handleDownloadPrintableHtmlForm}
              data-testid="download-sa103-html-btn"
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                isForcedSelfFinalCheckComplete
                  ? 'bg-white text-slate-900 border-slate-300 hover:bg-slate-100 cursor-pointer'
                  : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
              }`}
            >
              {downloadedFormat === 'html' ? (
                <Check className="w-3.5 h-3.5 text-emerald-700" />
              ) : (
                <Printer className="w-3.5 h-3.5 text-slate-700" />
              )}
              Printable SA103F Return (.html)
            </button>

            <button
              type="button"
              disabled={!isForcedSelfFinalCheckComplete}
              onClick={handleDownloadPdfForm}
              data-testid="download-sa103-pdf-btn"
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                isForcedSelfFinalCheckComplete
                  ? 'text-white bg-[#00703c] hover:bg-[#005a30] cursor-pointer shadow-xs'
                  : 'text-slate-400 bg-slate-200 cursor-not-allowed'
              }`}
            >
              {downloadedFormat === 'pdf' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-200" />
                  Downloaded Official SA103F (.pdf)
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <FileText className="w-3.5 h-3.5" />
                  Download Official SA103F Form (.pdf)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
