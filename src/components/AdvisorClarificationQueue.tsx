import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Paperclip,
  PackageCheck,
  Upload,
  ListChecks,
  Sliders,
  AlertTriangle,
  Wrench,
  MailQuestion,
  Copy,
} from 'lucide-react';
import {
  ExpenseItem,
  computeItemisedBillSummary,
  getOrBuildItemisedBillLines,
} from '../utils/taxEngine';
import {
  CURRENCY_SYMBOLS,
  SupportedCurrencyCode,
} from '../utils/currencyConverter';

interface AdvisorClarificationQueueProps {
  expenses: ExpenseItem[];
  onAnswerClarification: (expenseId: string, optionId: string) => void;
  onApplyCustomSplit?: (expenseId: string, customPercentage: number) => void;
  onToggleItemisedBillLine?: (expenseId: string, lineId: string) => void;
  onFixMediaError?: (
    expenseId: string,
    correctedAmountGbp: number,
    correctedDate?: string,
    note?: string
  ) => void;
  onRequestIssuerClarification?: (
    expenseId: string,
    customDraft?: string
  ) => void;
  onAttachProof: (expenseId: string, fileName: string) => void;
  onReopenClarification: (expenseId: string) => void;
  onInspectTrace: (item: ExpenseItem) => void;
  onOpenEvidenceFolder?: () => void;
  onJumpToSources?: () => void;
  currentProfit: number;
  strictGuardrail: boolean;
  onNextStep?: () => void;
}

export const AdvisorClarificationQueue: React.FC<AdvisorClarificationQueueProps> = ({
  expenses,
  onAnswerClarification,
  onApplyCustomSplit,
  onToggleItemisedBillLine,
  onFixMediaError,
  onRequestIssuerClarification,
  onAttachProof,
  onInspectTrace,
  onJumpToSources,
  onNextStep,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeUploadIdRef = useRef<string | null>(null);
  const [expandedSplitId, setExpandedSplitId] = useState<string | null>(null);
  const [openIssuerDraftId, setOpenIssuerDraftId] = useState<string | null>(
    null
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const adjustableItems = expenses.filter(
    (e) =>
      (e.status !== 'blocked_by_guardrail' &&
        e.clarificationOptions &&
        e.clarificationOptions.length > 0) ||
      Boolean(e.mediaError?.hasError)
  );

  const blockedItems = expenses.filter((e) => e.status === 'blocked_by_guardrail');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = activeUploadIdRef.current;
    if (file && targetId) {
      onAttachProof(targetId, file.name);
    }
    e.target.value = '';
  };

  return (
    <section
      id="advisor-qa"
      aria-labelledby="advisor-qa-heading"
      className="bg-white border border-slate-200 rounded-xl p-5"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.csv,.xlsx,.xls"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Upload HMRC proof file"
      />

      <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
        <div>
          <h2 id="advisor-qa-heading" className="text-sm font-bold text-slate-900">
            2. Review Splits &amp; Receipts
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Adjust any work/personal split or attach a receipt for HMRC.
          </p>
        </div>

        {onJumpToSources && (
          <button
            type="button"
            onClick={onJumpToSources}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-slate-700" />
            Upload More
          </button>
        )}
      </div>

      {adjustableItems.length === 0 ? (
        <div className="py-8 text-center space-y-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-700 mx-auto" />
          <h3 className="text-xs font-bold text-slate-900">
            No items uploaded yet
          </h3>
          <p className="text-xs text-slate-500">
            Upload a file in Step 1 to classify expenses.
          </p>
          {onJumpToSources && (
            <button
              type="button"
              onClick={onJumpToSources}
              className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Go to Step 1
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {adjustableItems.map((item) => {
            const isExpanded = expandedSplitId === item.id;
            const billLines =
              item.itemisedBillLines && item.itemisedBillLines.length > 0
                ? item.itemisedBillLines
                : getOrBuildItemisedBillLines(item);
            const billSummary = computeItemisedBillSummary(
              billLines,
              item.grossAmount
            );

            return (
              <div key={item.id} className="py-3 space-y-2.5 text-xs">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  {/* Left: Item name + Amount + Current Split */}
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="font-semibold text-slate-900 truncate">
                      {item.merchantOrDescription}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="font-mono text-slate-800 font-bold">
                      £{item.grossAmount.toLocaleString()}
                    </span>
                    {item.originalCurrency && item.originalCurrency !== 'GBP' && (
                      <span className="text-[11px] font-mono text-teal-700 font-semibold">
                        ({CURRENCY_SYMBOLS[
                          item.originalCurrency as SupportedCurrencyCode
                        ] || ''}
                        {item.originalAmount?.toLocaleString()}{' '}
                        {item.originalCurrency})
                      </span>
                    )}
                    <span className="text-slate-300">·</span>
                    <span className="font-mono text-slate-500 font-medium shrink-0">
                      {item.selectedOptionLabel || `${item.businessPercentage}% Work`}
                    </span>
                  </div>

                  {/* Right: Quick Switcher + Edit %/Bill + Attach Proof + Why? */}
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <div className="inline-flex items-center bg-slate-100 rounded-lg p-0.5">
                      {item.clarificationOptions?.map((opt) => {
                        const isActive =
                          item.selectedOptionLabel === opt.label ||
                          item.businessPercentage === opt.businessPercentage;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => onAnswerClarification(item.id, opt.id)}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                              isActive
                                ? 'bg-white text-slate-900 shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedSplitId(isExpanded ? null : item.id)
                      }
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                        isExpanded
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <ListChecks className="w-3.5 h-3.5 text-emerald-700" />
                      {isExpanded ? 'Close Split' : 'Custom % / Bill'}
                    </button>

                    {item.proofAttached ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <PackageCheck className="w-3.5 h-3.5 text-emerald-700" />
                        Receipt Saved
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          onAttachProof(
                            item.id,
                            `${item.sourceDocumentName.replace(/\..+$/, '')}_receipt.pdf`
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      >
                        <Paperclip className="w-3 h-3 text-slate-500" />
                        Attach Receipt
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onInspectTrace(item)}
                      className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      Why?
                    </button>
                  </div>
                </div>

                {/* Flagged Media Error Banner in Splits Queue */}
                {item.mediaError?.hasError && (
                  <div
                    className={`rounded-lg border p-3 space-y-2 text-xs ${
                      item.mediaError.resolutionStatus === 'fixed_by_user'
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                        : item.mediaError.resolutionStatus ===
                            'awaiting_issuer_clarification'
                          ? 'bg-sky-50/80 border-sky-200 text-sky-950'
                          : 'bg-amber-50/90 border-amber-300 text-amber-950'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
                        <div className="min-w-0">
                          <div className="font-bold">{item.mediaError.title}</div>
                          <p className="text-[11px] opacity-90 mt-0.5">
                            {item.mediaError.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {onFixMediaError &&
                          item.mediaError.suggestedCorrectedAmountGbp !==
                            item.grossAmount && (
                            <button
                              type="button"
                              onClick={() =>
                                onFixMediaError(
                                  item.id,
                                  item.mediaError!.suggestedCorrectedAmountGbp,
                                  undefined,
                                  `Corrected from £${item.mediaError!.claimedAmountGbp} to £${item.mediaError!.suggestedCorrectedAmountGbp}`
                                )
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md cursor-pointer"
                            >
                              <Wrench className="w-3 h-3" />
                              Fix Mistake (£
                              {item.mediaError.suggestedCorrectedAmountGbp.toLocaleString()}
                              )
                            </button>
                          )}

                        <button
                          type="button"
                          onClick={() =>
                            setOpenIssuerDraftId(
                              openIssuerDraftId === item.id ? null : item.id
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-sky-900 bg-white border border-sky-300 hover:bg-sky-50 rounded-md cursor-pointer"
                        >
                          <MailQuestion className="w-3 h-3 text-sky-700" />
                          Seek Clarification from Issuer
                        </button>
                      </div>
                    </div>

                    {openIssuerDraftId === item.id && (
                      <div className="p-2.5 bg-white border border-sky-200 rounded-md space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-800">
                            Clarification Request to Merchant / Issuer:
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(
                                item.mediaError!.issuerClarificationDraft
                              );
                              setCopiedId(item.id);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            {copiedId === item.id ? 'Copied!' : 'Copy Message'}
                          </button>
                        </div>
                        <pre className="p-2 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono whitespace-pre-wrap text-slate-700">
                          {item.mediaError.issuerClarificationDraft}
                        </pre>
                        {onRequestIssuerClarification && (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                onRequestIssuerClarification(item.id);
                                setOpenIssuerDraftId(null);
                              }}
                              className="px-3 py-1 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-md cursor-pointer"
                            >
                              Hold Claim &amp; Await Issuer Reply (£0)
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Expandable Custom % Slider & Clickable Itemised Receipt Checklist */}
                {isExpanded && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {onApplyCustomSplit && (
                        <div className="flex items-center gap-2">
                          <Sliders className="w-3.5 h-3.5 text-emerald-700" />
                          <span className="font-semibold text-slate-700">
                            Custom Work %:
                          </span>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={item.businessPercentage}
                            onChange={(e) =>
                              onApplyCustomSplit(item.id, Number(e.target.value))
                            }
                            className="w-28 accent-emerald-700 cursor-pointer"
                          />
                          <input
                            type="number"
                            min={0}
                            max={100}
                            aria-label={`Custom split percentage for ${item.merchantOrDescription}`}
                            value={item.businessPercentage}
                            onChange={(e) =>
                              onApplyCustomSplit(item.id, Number(e.target.value))
                            }
                            className="w-14 px-1.5 py-0.5 text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded text-center"
                          />
                          <span className="font-mono font-bold text-slate-600">
                            %
                          </span>
                        </div>
                      )}

                      <span className="font-mono font-bold text-emerald-800">
                        Selected: £{billSummary.businessGbp.toFixed(0)} / £
                        {billSummary.totalBillGbp.toFixed(0)} (
                        {billSummary.computedPercentage}%)
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-lg overflow-hidden">
                      {billLines.map((line) => (
                        <button
                          key={line.id}
                          type="button"
                          onClick={() =>
                            onToggleItemisedBillLine?.(item.id, line.id)
                          }
                          className={`w-full px-3 py-1.5 flex items-center justify-between gap-3 text-left text-xs transition-colors cursor-pointer ${
                            line.isBusiness
                              ? 'bg-emerald-50/40 hover:bg-emerald-50'
                              : 'bg-white hover:bg-slate-50 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] font-bold shrink-0 ${
                                line.isBusiness
                                  ? 'bg-emerald-700 border-emerald-700 text-white'
                                  : 'bg-white border-slate-300 text-transparent'
                              }`}
                            >
                              ✓
                            </span>
                            <span
                              className={`font-medium truncate ${
                                line.isBusiness
                                  ? 'text-slate-900'
                                  : 'line-through text-slate-400'
                              }`}
                            >
                              {line.description}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-bold text-slate-900">
                              £{line.amountGbp.toFixed(2)}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                line.isBusiness
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {line.isBusiness ? 'Work' : 'Personal'}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Compact Blocked Banner */}
      {blockedItems.length > 0 && (
        <div className="mt-3 px-3 py-2 bg-red-50/70 border border-red-200/80 rounded-lg flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0 text-red-900">
            <ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <span className="truncate">
              <strong>Blocked (£0):</strong>{' '}
              {blockedItems[0].merchantOrDescription} (£
              {blockedItems[0].grossAmount}) — Disallowed by HMRC rule
            </span>
          </div>
          <button
            type="button"
            onClick={() => onInspectTrace(blockedItems[0])}
            className="text-red-700 hover:underline font-semibold shrink-0 cursor-pointer"
          >
            Why?
          </button>
        </div>
      )}

      {onNextStep && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onNextStep}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            Next: Reliefs
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </section>
  );
};
