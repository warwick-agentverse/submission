import React, { useState } from 'react';
import {
  Search,
  ArrowUpRight,
  Download,
  GitCommitHorizontal,
  AlertTriangle,
} from 'lucide-react';
import {
  DataSourceType,
  ExpenseItem,
  ExpenseStatus,
  TaxReliefSubsidy,
  TaxSummaryMetrics,
  filterExpenses,
  getDeductibleAmount,
  estimateMarginalSaving,
  evaluateExpenseTrace,
} from '../utils/taxEngine';
import {
  CURRENCY_SYMBOLS,
  SupportedCurrencyCode,
} from '../utils/currencyConverter';
import { TaxTermTooltip } from './TaxTermTooltip';

interface ExpenseLedgerTableProps {
  expenses: ExpenseItem[];
  reliefs: TaxReliefSubsidy[];
  summary: TaxSummaryMetrics;
  currentProfit: number;
  strictGuardrail: boolean;
  onJumpToClarification: (expenseId: string) => void;
  onInspectTrace: (item: ExpenseItem) => void;
  onOpenExportModal: () => void;
  onResetDemo: () => void;
}

const SOURCE_LABELS: Record<DataSourceType, string> = {
  bank_statement: 'Bank',
  receipt: 'Receipt',
  invoice: 'Invoice',
  car_journey: 'Mileage',
};

const STATUS_LABELS: Record<ExpenseStatus, string> = {
  verified: 'Verified',
  needs_clarification: 'Pending',
  personal: 'Personal',
  blocked_by_guardrail: 'Blocked',
};

export const ExpenseLedgerTable: React.FC<ExpenseLedgerTableProps> = ({
  expenses,
  currentProfit,
  strictGuardrail,
  onJumpToClarification,
  onInspectTrace,
  onOpenExportModal,
}) => {
  const [sourceFilter, setSourceFilter] = useState<DataSourceType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const visibleRows = filterExpenses(expenses, sourceFilter, 'all', searchQuery);

  const visibleTotalDeductible = visibleRows.reduce(
    (sum, item) => sum + getDeductibleAmount(item, strictGuardrail),
    0
  );

  return (
    <section
      id="expense-ledger"
      aria-labelledby="ledger-heading"
      className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 id="ledger-heading" className="text-sm font-bold text-slate-900">
            4. Final Expense Ledger
          </h2>
          <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'bank_statement', label: 'Bank' },
                { id: 'receipt', label: 'Receipts' },
                { id: 'invoice', label: 'Invoices' },
                { id: 'car_journey', label: 'Mileage' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSourceFilter(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  sourceFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative w-44">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              aria-label="Filter items"
              className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400"
            />
          </div>

          <button
            type="button"
            onClick={onOpenExportModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            SA103 Pack
          </button>
        </div>
      </div>

      {visibleRows.length === 0 ? (
        <div className="py-8 text-center border-t border-slate-100">
          <p className="text-xs font-medium text-slate-500">No matching items</p>
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-medium text-slate-400">
                <th className="py-2.5 pl-2 pr-3">Date</th>
                <th className="py-2.5 px-3">Item</th>
                <th className="py-2.5 px-3">AI vs. Code</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3 text-right">
                  <TaxTermTooltip termKey="deductible">Deductible</TaxTermTooltip>
                </th>
                <th className="py-2.5 px-3 text-right">Saved</th>
                <th className="py-2.5 pl-3 pr-2 text-right">Proof</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {visibleRows.map((item) => {
                const trace = evaluateExpenseTrace(
                  item,
                  currentProfit,
                  strictGuardrail
                );
                const deductible = getDeductibleAmount(item, strictGuardrail);
                const taxSaved = estimateMarginalSaving(deductible, currentProfit);

                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 pl-2 pr-3 whitespace-nowrap text-slate-400 font-mono">
                      {item.date} · {SOURCE_LABELS[item.source]}
                    </td>

                    <td className="py-2.5 px-3 font-medium text-slate-900">
                      {item.merchantOrDescription}
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {item.status === 'needs_clarification' ? (
                          <button
                            type="button"
                            onClick={() => onJumpToClarification(item.id)}
                            className="inline-flex items-center gap-0.5 font-semibold text-amber-700 hover:underline cursor-pointer"
                          >
                            Clarify
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        ) : item.status === 'blocked_by_guardrail' ? (
                          <span className="text-red-600 font-semibold">
                            Blocked (0%)
                          </span>
                        ) : (
                          <span
                            className={
                              item.status === 'verified'
                                ? 'text-emerald-700 font-medium'
                                : 'text-slate-400'
                            }
                          >
                            {STATUS_LABELS[item.status]} ({trace.codeEnforcedPct}%)
                          </span>
                        )}

                        {trace.aiCodeDisagreement && (
                          <button
                            type="button"
                            onClick={() => onInspectTrace(item)}
                            title={trace.disagreementReason || 'AI and Code disagreed'}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-bold text-amber-900 bg-amber-100 border border-amber-300 rounded cursor-pointer"
                          >
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-700" />
                            AI:{trace.aiSuggestedPct}%≠Code:{trace.codeEnforcedPct}%
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      <div>£{trace.rawGrossAmount.toLocaleString()}</div>
                      {item.originalCurrency && item.originalCurrency !== 'GBP' && (
                        <div className="text-[10px] text-teal-700 font-semibold">
                          {CURRENCY_SYMBOLS[
                            item.originalCurrency as SupportedCurrencyCode
                          ] || ''}
                          {(item.originalAmount ?? item.grossAmount).toLocaleString()}{' '}
                          {item.originalCurrency}
                        </div>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                      {item.status === 'needs_clarification'
                        ? '—'
                        : `£${deductible.toLocaleString()}`}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-700 whitespace-nowrap">
                      {item.status === 'verified' && taxSaved > 0
                        ? `+£${taxSaved.toLocaleString()}`
                        : '—'}
                    </td>

                    <td className="py-2.5 pl-3 pr-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onInspectTrace(item)}
                        title="Trace raw data → calculation → output"
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-md bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                      >
                        <GitCommitHorizontal className="w-3.5 h-3.5" />
                        Why?
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 font-semibold text-xs text-slate-900">
                <td colSpan={4} className="py-2.5 pl-2 pr-3 text-slate-500 font-normal">
                  {visibleRows.length} items · Click any row&apos;s trace icon to inspect [AI Judgement] vs [Deterministic Code]
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                  £{visibleTotalDeductible.toLocaleString()}
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700">
                  +£{estimateMarginalSaving(visibleTotalDeductible, currentProfit).toLocaleString()}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
};
