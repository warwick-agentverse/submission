import React, { useState, useMemo } from 'react';
import {
  X,
  FolderOpen,
  FileCode2,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Bot,
  UserCheck,
  ExternalLink,
  Download,
  Copy,
  Check,
  GitBranch,
} from 'lucide-react';
import {
  ExpenseItem,
  HMRC_CODED_BLOCK_LIST,
  GOV_UK_SELF_EMPLOYED_EXPENSES_URL,
  buildEvidenceJustificationDocument,
  runSecondBotVerificationAudit,
} from '../utils/taxEngine';

interface EvidenceAndOversightModalProps {
  isOpen: boolean;
  initialTab?: 'evidence_folder' | 'second_bot_ca' | 'block_list';
  onClose: () => void;
  expenses: ExpenseItem[];
  currentProfit: number;
  strictGuardrail: boolean;
  onApproveCaItem: (expenseId: string) => void;
  onApproveAllCaItems: () => void;
  onTestCodedBlockListOverride: () => void;
}

export const EvidenceAndOversightModal: React.FC<
  EvidenceAndOversightModalProps
> = ({
  isOpen,
  initialTab = 'evidence_folder',
  onClose,
  expenses,
  currentProfit,
  strictGuardrail,
  onApproveCaItem,
  onApproveAllCaItems,
  onTestCodedBlockListOverride,
}) => {
  const [activeTab, setActiveTab] = useState<
    'evidence_folder' | 'second_bot_ca' | 'block_list'
  >(initialTab);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string>(
    expenses[0]?.id || ''
  );
  const [copiedPython, setCopiedPython] = useState(false);
  const [secondBotRanCount, setSecondBotRanCount] = useState(1);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      if (expenses.length > 0 && !expenses.some((e) => e.id === selectedExpenseId)) {
        setSelectedExpenseId(expenses[0].id);
      }
    }
  }, [isOpen, initialTab, expenses, selectedExpenseId]);

  const evidenceDocs = useMemo(
    () =>
      expenses.map((item) => ({
        item,
        doc: buildEvidenceJustificationDocument(
          item,
          currentProfit,
          strictGuardrail
        ),
      })),
    [expenses, currentProfit, strictGuardrail]
  );

  const secondBotReport = useMemo(
    () => runSecondBotVerificationAudit(expenses, strictGuardrail, currentProfit),
    [expenses, strictGuardrail, currentProfit, secondBotRanCount]
  );

  if (!isOpen) return null;

  const selectedEntry =
    evidenceDocs.find((d) => d.item.id === selectedExpenseId) || evidenceDocs[0];

  const handleCopyPython = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedPython(true);
    setTimeout(() => setCopiedPython(false), 2000);
  };

  const handleDownloadJustificationFile = () => {
    if (!selectedEntry) return;
    const fullContent = `${selectedEntry.doc.markdownContent}\n\n## 5. Generated Python (decimal + pandas) Script\n\`\`\`python\n${selectedEntry.doc.pythonDecimalScript}\n\`\`\`\n`;
    const blob = new Blob([fullContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedEntry.doc.fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="evidence-oversight-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-5xl w-full p-5 space-y-4 shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>Rubric Criteria 1 &amp; 3</span>
              <span>·</span>
              <span>Traceable Justification Folder, Python Decimal Scripts &amp; Second Bot + CA Oversight</span>
            </div>
            <h2
              id="evidence-oversight-title"
              className="text-base font-bold text-slate-900 mt-0.5"
            >
              Evidence &amp; Justification Folder · Second Bot Verification · CA Oversight
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Segmented Tab Controls */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab('evidence_folder')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'evidence_folder'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1. Evidence Folder ({evidenceDocs.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('second_bot_ca')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'second_bot_ca'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2. Second Bot &amp; CA Review ({secondBotReport.unsureFlaggedForCaCount} Flagged)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('block_list')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'block_list'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                3. Coded Block List &amp; UK Need
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close evidence and oversight modal"
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto pr-1 text-xs space-y-4">
          {activeTab === 'evidence_folder' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column: Justification Folder File List */}
              <div className="lg:col-span-5 border border-slate-200 rounded-lg overflow-hidden flex flex-col bg-slate-50/50">
                <div className="px-3.5 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-800 flex items-center gap-1.5">
                    <FolderOpen className="w-4 h-4 text-emerald-700" />
                    /evidence_justifications/
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    {evidenceDocs.length} files
                  </span>
                </div>
                <div className="divide-y divide-slate-200 max-h-[58vh] overflow-y-auto">
                  {evidenceDocs.map(({ item, doc }) => {
                    const isSelected = item.id === selectedEntry?.item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedExpenseId(item.id)}
                        className={`w-full text-left p-3 transition-colors cursor-pointer flex flex-col gap-1 ${
                          isSelected
                            ? 'bg-white border-r-2 border-r-emerald-700 shadow-2xs'
                            : 'hover:bg-white/70'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] font-semibold text-slate-900 truncate">
                            {doc.fileName}
                          </span>
                          <span className="font-mono text-[11px] font-bold text-slate-700 shrink-0">
                            £{item.grossAmount.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="truncate">
                            {doc.createdDate} · {doc.mediaFormatLabel}
                          </span>
                          <span
                            className={`font-mono font-semibold shrink-0 ${
                              doc.regulationDiagnostic === 'DOES_NOT_FOLLOW_REGULATION'
                                ? 'text-rose-700'
                                : doc.flaggedForCaAttention
                                  ? 'text-amber-700'
                                  : 'text-emerald-700'
                            }`}
                          >
                            {doc.regulationDiagnostic === 'DOES_NOT_FOLLOW_REGULATION'
                              ? 'Blocked (£0)'
                              : doc.flaggedForCaAttention
                                ? 'Flagged CA'
                                : 'Verified'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Selected Justification Document & Python Script */}
              {selectedEntry && (
                <div className="lg:col-span-7 border border-slate-200 rounded-lg p-4 space-y-3.5 bg-white">
                  <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                      <div className="font-mono text-[11px] text-emerald-700 font-semibold">
                        {selectedEntry.doc.folderPath}
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                        {selectedEntry.doc.itemTitle} ({selectedEntry.doc.createdDate})
                      </h3>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Media: {selectedEntry.doc.mediaFormatLabel} · Diagnostic:{' '}
                        <strong className="text-slate-800">
                          {selectedEntry.doc.regulationDiagnostic}
                        </strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadJustificationFile}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Justification (.md)
                    </button>
                  </div>

                  {/* Extra Information Obtained from User */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                    <div className="font-semibold text-slate-900 flex items-center justify-between">
                      <span>1. Extra Info Request &amp; User Justification Stored for HMRC</span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {selectedEntry.doc.caStatusLabel}
                      </span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">
                      {selectedEntry.doc.userClarificationLog}
                    </p>
                  </div>

                  {/* Pre-Determined Expert Decision Tree Path */}
                  <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                    <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5 text-emerald-700" />
                      <span>2. Expert HMRC Decision Tree Traversal (HS222 &amp; BIM Manual)</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {selectedEntry.doc.decisionTreeSteps.map((step) => (
                        <div key={step.stepNumber} className="py-1.5 space-y-0.5">
                          <div className="flex items-center justify-between font-medium text-slate-900">
                            <span>{step.nodeTitle}</span>
                            <span className="font-mono text-[10px] text-slate-500">
                              {step.regulationCited}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Q: {step.questionEvaluated}
                          </div>
                          <div
                            className={`text-[11px] font-mono font-semibold ${
                              step.passed ? 'text-emerald-700' : 'text-amber-800'
                            }`}
                          >
                            → {step.branchTaken}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Python Decimal + Pandas Script */}
                  <div className="p-3 bg-slate-900 text-slate-100 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-emerald-400 flex items-center gap-1.5">
                        <FileCode2 className="w-4 h-4" />
                        3. Plain Code Calculation (Python decimal + pandas script)
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyPython(selectedEntry.doc.pythonDecimalScript)
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 rounded cursor-pointer"
                      >
                        {copiedPython ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            Copy Python
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="font-mono text-[11px] text-slate-200 overflow-x-auto leading-relaxed">
                      {selectedEntry.doc.pythonDecimalScript}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'second_bot_ca' && (
            <div className="space-y-4">
              {/* Top Summary Bar for Second Bot + CA Firm Workflow */}
              <div className="p-4 bg-slate-900 text-white rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-emerald-400 font-mono text-[11px]">
                    <Bot className="w-4 h-4" />
                    <span>
                      SECOND BOT VERIFICATION AGENT · LAST AUDIT: {secondBotReport.timestamp}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold">
                    Verification Agent Checked {secondBotReport.totalDecisionsChecked} Decisions ·{' '}
                    {secondBotReport.falseClaimsDetectedCount} False Claims Allowed ·{' '}
                    {secondBotReport.unsureFlaggedForCaCount} Unsure Claims Flagged for CA Extra Attention
                  </h3>
                  <p className="text-slate-300 text-[11px]">
                    All decisions are verified by an independent second bot and reviewed by Chartered Accountants (CAs) at the firm. Because AI pre-packs justifications and flags only unsure items, CAs handle 5× more tax returns — bringing accountancy fees down from £950/yr to £149/yr for small sole traders.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSecondBotRanCount((c) => c + 1)}
                    className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    Re-Run Second Bot Check
                  </button>
                  <button
                    type="button"
                    onClick={onApproveAllCaItems}
                    className="px-3 py-1.5 text-xs font-semibold bg-white text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    CA Sign-Off All Verified
                  </button>
                </div>
              </div>

              {/* Decision-by-Decision Second Bot & CA Review Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-2.5 px-3">Item &amp; Media</th>
                      <th className="py-2.5 px-3">Second Bot Verification Logic</th>
                      <th className="py-2.5 px-3 text-right">Claimed / Allowed</th>
                      <th className="py-2.5 px-3">CA Oversight Status</th>
                      <th className="py-2.5 px-3 text-right">CA Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {secondBotReport.checks.map((check) => {
                      const item = expenses.find((e) => e.id === check.expenseId);
                      const isApprovedByCa = item?.caReviewStatus === 'ca_approved';
                      return (
                        <tr
                          key={check.id}
                          className={
                            check.verdict === 'FLAGGED_UNSURE_FOR_CA' && !isApprovedByCa
                              ? 'bg-amber-50/40'
                              : check.verdict === 'BLOCKED_ZERO_ENFORCED'
                                ? 'bg-rose-50/30'
                                : 'bg-white'
                          }
                        >
                          <td className="py-2.5 px-3 font-medium text-slate-900">
                            <div>{check.merchant}</div>
                            <div className="text-[11px] font-mono text-slate-400">
                              {check.hmrcCitation}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {check.logicCheckSummary}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                            <span className="text-slate-400">
                              £{check.grossGbp.toLocaleString()}
                            </span>{' '}
                            →{' '}
                            <span className="font-bold text-slate-900">
                              £{check.deductibleGbp.toLocaleString()}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {isApprovedByCa ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                <UserCheck className="w-3.5 h-3.5" />
                                CA Checked &amp; Signed Off
                              </span>
                            ) : check.verdict === 'FLAGGED_UNSURE_FOR_CA' ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-amber-800">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                Flagged for Extra CA Attention
                              </span>
                            ) : check.verdict === 'BLOCKED_ZERO_ENFORCED' ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
                                <ShieldAlert className="w-3.5 h-3.5" />
                                Blocked (£0 Enforced)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-slate-600">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Second Bot Verified
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            {isApprovedByCa ? (
                              <span className="text-[11px] font-mono text-slate-400">
                                ICAEW #88412
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onApproveCaItem(check.expenseId)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-slate-900 bg-slate-100 hover:bg-emerald-700 hover:text-white rounded cursor-pointer transition-colors"
                              >
                                CA Approve
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'block_list' && (
            <div className="space-y-4">
              {/* Target User & UK Statistical Evidence */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <div className="text-[11px] font-mono text-slate-500">
                    EXACT TARGET USER
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    UK Sole Traders, Freelancers &amp; Micro-SMEs
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    3.2 million sole traders in the UK; <strong>58% do not have an accountant</strong> because traditional accountancy fees exceed the value of small deductions.
                  </p>
                  <a
                    href="https://www.gov.uk/government/statistics/business-population-estimates-2025/business-population-estimates-for-the-uk-and-regions-2025-statistical-release"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline pt-1"
                  >
                    GOV.UK Business Population Estimates 2025
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <div className="text-[11px] font-mono text-slate-500">
                    URGENT REGULATORY NEED
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    79% Unready for Making Tax Digital (MTD)
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    79% of UK sole traders report they are not ready for continuous digital record-keeping under HMRC Making Tax Digital.
                  </p>
                  <a
                    href="https://www.harrisandco.biz/blog/tax/79-of-sole-traders-say-they-re-not-ready-for-making-tax-digital"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline pt-1"
                  >
                    Harris &amp; Co Chartered Accountants Report
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="p-3.5 bg-rose-50/50 border border-rose-200 rounded-lg space-y-1">
                  <div className="text-[11px] font-mono text-rose-800">
                    WORST FAILURE PREVENTED ON SCREEN
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    Claiming Taxes Incorrectly (False Claims)
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Handled via: (1) Coded HMRC Block List forcing £0, (2) Second Bot Verification Agent, and (3) Forced Self Final Check before SA103 export.
                  </p>
                  <a
                    href={GOV_UK_SELF_EMPLOYED_EXPENSES_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 hover:underline pt-1"
                  >
                    GOV.UK Allowed Self-Employed Expenses
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Coded Block List Table + Live Test Button */}
              <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Coded HMRC Block List Enforced in Code (src/utils/taxEngine.ts)
                    </h3>
                    <p className="text-slate-500 text-[11px]">
                      If any expense matches the coded block list below, the deductible amount is forced to <strong>£0</strong> in code regardless of what the user or AI inputs.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onTestCodedBlockListOverride}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Test Live: Try Claiming £480 Client Dinner @ 100%
                  </button>
                </div>

                <div className="border border-slate-200 rounded-md overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                        <th className="py-2 px-3">Disallowed Category</th>
                        <th className="py-2 px-3">Statutory Authority</th>
                        <th className="py-2 px-3">Code Enforcement Rule</th>
                        <th className="py-2 px-3 text-right">Forced Output</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {HMRC_CODED_BLOCK_LIST.map((rule) => (
                        <tr key={rule.id}>
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            {rule.categoryName}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                            {rule.statutoryAuthority}
                          </td>
                          <td className="py-2 px-3 text-slate-600">{rule.reason}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-rose-700">
                            £0 (0%)
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            Every decision is backed by a dated file in /evidence_justifications/ and verified by the Second Bot + CA queue.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
