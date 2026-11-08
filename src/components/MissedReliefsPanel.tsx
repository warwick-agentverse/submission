import React, { useState } from 'react';
import {
  Check,
  Plus,
  ArrowRight,
  ExternalLink,
  GitCommitHorizontal,
  X,
  Calculator,
  HelpCircle,
} from 'lucide-react';
import {
  TaxReliefSubsidy,
  estimateMarginalSaving,
  getReliefDeductionAmount,
  getMarginalCombinedRate,
} from '../utils/taxEngine';
import { TaxTermTooltip, JargonKey } from './TaxTermTooltip';

interface MissedReliefsPanelProps {
  reliefs: TaxReliefSubsidy[];
  onToggleRelief: (reliefId: string) => void;
  onClaimAllRecommended: () => void;
  currentProfit: number;
  onNextStep?: () => void;
}

const RELIEF_TOOLTIP_MAP: Record<string, JargonKey> = {
  'relief-home-office': 'relief',
  'relief-pre-trading': 'pre_trading',
  'relief-sipp-uplift': 'sipp',
  'relief-aia-pool': 'aia',
  'relief-eyecare-cpd': 'deductible',
  'relief-trivial-spouse': 'deductible',
};

export const MissedReliefsPanel: React.FC<MissedReliefsPanelProps> = ({
  reliefs,
  onToggleRelief,
  onClaimAllRecommended,
  currentProfit,
  onNextStep,
}) => {
  const [tracedRelief, setTracedRelief] = useState<TaxReliefSubsidy | null>(null);

  const unclaimedCount = reliefs.filter((r) => !r.claimed).length;
  const unclaimedDeductionTotal = reliefs
    .filter((r) => !r.claimed)
    .reduce((sum, r) => sum + getReliefDeductionAmount(r), 0);
  const unclaimedTaxSaving = estimateMarginalSaving(
    unclaimedDeductionTotal,
    currentProfit
  );

  const marginalRate = getMarginalCombinedRate(currentProfit);

  return (
    <section
      id="tax-reliefs"
      aria-labelledby="reliefs-heading"
      className="bg-white border border-slate-200 rounded-xl p-5"
    >
      <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
        <div>
          <h2 id="reliefs-heading" className="text-sm font-bold text-slate-900">
            3. Claim <TaxTermTooltip termKey="relief">Tax Reliefs</TaxTermTooltip>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            One-click UK allowances unlocked from your expenses.
          </p>
        </div>

        {unclaimedCount > 0 && (
          <button
            type="button"
            onClick={onClaimAllRecommended}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Claim All (+£{unclaimedTaxSaving.toLocaleString()})
          </button>
        )}
      </div>

      {reliefs.length === 0 ? (
        <div className="py-6 text-center">
          <h3 className="text-xs font-bold text-slate-900">
            No Reliefs Unlocked Yet — Upload a Source File in Stage 1
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Gemini AI automatically discovers eligible HMRC reliefs &amp; subsidies from your uploaded statements, receipts, and invoices.
          </p>
        </div>
      ) : (
      <div className="divide-y divide-slate-100">
        {reliefs.map((relief) => {
          const deductionAmt = getReliefDeductionAmount(relief);
          const dynamicSaving = estimateMarginalSaving(
            deductionAmt,
            currentProfit
          );
          const tooltipKey = RELIEF_TOOLTIP_MAP[relief.id] || 'relief';
          return (
            <div
              key={relief.id}
              className="py-3 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {relief.title}
                  </h3>
                  <span className="text-xs text-slate-300">·</span>
                  <span className="text-xs text-slate-500">
                    <TaxTermTooltip termKey={tooltipKey}>
                      {relief.authorityCode}
                    </TaxTermTooltip>
                  </span>
                  {relief.hmrcUrl && (
                    <a
                      href={relief.hmrcUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-700 hover:text-emerald-900 hover:underline whitespace-nowrap"
                    >
                      GOV.UK
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  {relief.whyOftenMissed}
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setTracedRelief(relief)}
                  title="Inspect raw data → code calculation → output"
                  className="p-1.5 text-slate-400 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  <GitCommitHorizontal className="w-3.5 h-3.5" />
                </button>

                <span className="text-xs font-bold font-mono tabular-nums text-emerald-700 w-14 text-right">
                  +£{dynamicSaving.toLocaleString()}
                </span>

                <button
                  type="button"
                  onClick={() => onToggleRelief(relief.id)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                    relief.claimed
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-slate-900 text-white border-slate-900 hover:bg-emerald-700 hover:border-emerald-700'
                  }`}
                >
                  {relief.claimed ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                      Claimed
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      Claim
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {onNextStep && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onNextStep}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            Next: Ledger
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Relief Trace Modal: Raw Data -> Code Calculation -> Output */}
      {tracedRelief && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-5 space-y-3.5 shadow-xl text-xs">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-semibold">
                  Relief Decision Trace ({tracedRelief.authorityCode})
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {tracedRelief.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTracedRelief(null)}
                className="p-1 text-slate-400 hover:text-slate-900 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-indigo-50/50 border border-indigo-200 rounded-lg space-y-1">
              <div className="flex items-center justify-between font-semibold text-indigo-950">
                <span>1. Raw Transaction Detection</span>
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-indigo-100 text-indigo-900 rounded">
                  [AI Judgement]
                </span>
              </div>
              <p className="text-slate-700">{tracedRelief.aiDetectionEvidence}</p>
            </div>

            <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg space-y-1.5">
              <div className="flex items-center justify-between font-semibold text-emerald-950">
                <span className="inline-flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-emerald-700" />
                  2. Reproducible Calculation (getReliefDeductionAmount)
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-emerald-100 text-emerald-900 rounded">
                  [Deterministic Code]
                </span>
              </div>
              <div className="p-2.5 bg-white border border-emerald-200 rounded font-mono text-[11px] space-y-1">
                <div>
                  Formula:{' '}
                  {tracedRelief.rawInputs?.formulaExplanation ||
                    `£${tracedRelief.annualDeductionAmount.toLocaleString()} × 100%`}
                </div>
                <div>
                  Deductible Write-Off = £
                  {getReliefDeductionAmount(tracedRelief).toLocaleString()}
                </div>
                <div className="font-bold text-emerald-800">
                  Tax + NI Saved = £
                  {getReliefDeductionAmount(tracedRelief).toLocaleString()} ×{' '}
                  {marginalRate} = +£
                  {estimateMarginalSaving(
                    getReliefDeductionAmount(tracedRelief),
                    currentProfit
                  ).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
              <div className="font-semibold text-slate-900 inline-flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-slate-600" />
                3. What Would Change This Decision?
              </div>
              <p className="text-slate-600">
                {tracedRelief.whatWouldChangeMind ||
                  'Requires supporting bank or receipt evidence retained under TMA 1970 s.12B.'}
              </p>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setTracedRelief(null)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
              >
                Close Trace
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
