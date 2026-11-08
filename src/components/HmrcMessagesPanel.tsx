import React, { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Clock,
  Code2,
  ExternalLink,
  FileCode2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  ArrowRight,
} from 'lucide-react';
import {
  HmrcRegulationChangeMessage,
  SIMULATED_NEW_HMRC_BULLETIN_PRESETS,
} from '../utils/hmrcRegulationMonitor';

interface HmrcMessagesPanelProps {
  messages: HmrcRegulationChangeMessage[];
  onApproveAndApplyPatch: (messageId: string) => void;
  onRevertOrRejectPatch: (messageId: string) => void;
  onSimulateLiveHmrcScan: (customBulletinText?: string) => Promise<void>;
  isScanningHmrc: boolean;
  onGoToUploadStep: () => void;
}

export const HmrcMessagesPanel: React.FC<HmrcMessagesPanelProps> = ({
  messages,
  onApproveAndApplyPatch,
  onRevertOrRejectPatch,
  onSimulateLiveHmrcScan,
  isScanningHmrc,
  onGoToUploadStep,
}) => {
  const [selectedMessageId, setSelectedMessageId] = useState<string>(
    messages[0]?.id || 'hmrc-msg-2026-amap-48p'
  );
  const [customBulletinInput, setCustomBulletinInput] = useState<string>('');
  const [showCustomScanBox, setShowCustomScanBox] = useState<boolean>(false);

  const pendingCount = messages.filter(
    (m) => m.status === 'pending_expert_approval'
  ).length;
  const approvedCount = messages.filter(
    (m) => m.status === 'approved_and_applied_to_code'
  ).length;

  const activeMessage =
    messages.find((m) => m.id === selectedMessageId) || messages[0];

  return (
    <section
      aria-labelledby="hmrc-messages-heading"
      data-testid="hmrc-messages-panel"
      className="space-y-4"
    >
      {/* Top Header & Explanation Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 font-semibold">
                <Bell className="w-3.5 h-3.5 text-amber-700" />
                {pendingCount} Pending Expert Code Approval
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                {approvedCount} Applied to taxEngine.ts
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                HMRC BIM · HS222 · Finance Act Feed
              </span>
            </div>
            <h2
              id="hmrc-messages-heading"
              className="text-base font-bold text-slate-900 mt-1.5"
            >
              Messages: HMRC Regulation Changes &amp; Pending Hard-Code Updates
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              When HMRC updates tax rates, reliefs, or disallowance rules, our AI monitors the legislative change, notifies you here, and drafts the exact <strong>TypeScript hard-code diff (<code>src/utils/taxEngine.ts</code>)</strong> for a Chartered Tax Adviser &amp; Engineer to verify before the programme&apos;s calculation engine is updated.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isScanningHmrc}
              data-testid="simulate-hmrc-scan-btn"
              onClick={() => onSimulateLiveHmrcScan()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
            >
              {isScanningHmrc ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  Scanning HMRC Feed...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  Simulate New HMRC Reg Change (AI Scan)
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowCustomScanBox((prev) => !prev)}
              className="px-2.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Custom HMRC Rule
            </button>
          </div>
        </div>

        {/* Optional Custom HMRC Bulletin Input */}
        {showCustomScanBox && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
            <div className="font-semibold text-slate-800">
              Test AI Hard-Code Diff Generator on Any Custom HMRC Regulation Change:
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={customBulletinInput}
                onChange={(e) => setCustomBulletinInput(e.target.value)}
                placeholder={
                  SIMULATED_NEW_HMRC_BULLETIN_PRESETS[0].bulletinText
                }
                className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
              />
              <button
                type="button"
                disabled={isScanningHmrc}
                onClick={() => {
                  onSimulateLiveHmrcScan(
                    customBulletinInput.trim() ||
                      SIMULATED_NEW_HMRC_BULLETIN_PRESETS[0].bulletinText
                  );
                  setCustomBulletinInput('');
                  setShowCustomScanBox(false);
                }}
                className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg cursor-pointer shrink-0"
              >
                Generate Code Diff
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Split View: Left Inbox List + Right Notification & Hard-Code Diff Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Messages List (4 cols) */}
        <div className="lg:col-span-4 space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 px-1">
            Regulation Update Inbox ({messages.length})
          </div>
          {messages.map((msg) => {
            const isSelected = activeMessage?.id === msg.id;
            const isApproved = msg.status === 'approved_and_applied_to_code';
            const isRejected = msg.status === 'rejected_by_expert';

            return (
              <button
                key={msg.id}
                type="button"
                data-testid={`hmrc-msg-item-${msg.id}`}
                onClick={() => setSelectedMessageId(msg.id)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                  isSelected
                    ? 'bg-white border-slate-900 shadow-xs ring-1 ring-slate-900'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                  {isApproved ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                      APPROVED &amp; APPLIED
                    </span>
                  ) : isRejected ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                      HELD / REJECTED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300 font-bold">
                      <Clock className="w-3 h-3 text-amber-700" />
                      PENDING APPROVAL
                    </span>
                  )}
                  <span className="text-slate-400">{msg.detectedAt}</span>
                </div>

                <div className="text-xs font-bold text-slate-900 leading-snug">
                  {msg.userNotificationTitle}
                </div>

                <div className="text-[11px] font-mono text-slate-500 truncate">
                  {msg.hmrcManualSection}
                </div>

                <div className="text-[11px] font-semibold text-emerald-800 pt-0.5">
                  {msg.estimatedUserImpactLabel}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Column: Active Message Details + AI Hard-Code Diff for Expert Check (8 cols) */}
        {activeMessage && (
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            {/* 1. User Notification Header */}
            <div className="space-y-2 pb-3.5 border-b border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-mono text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  {activeMessage.hmrcNoticeReference}
                </span>
                <a
                  href={activeMessage.officialSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900"
                >
                  HMRC Guidance Reference
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <h3 className="text-base font-bold text-slate-900">
                {activeMessage.userNotificationTitle}
              </h3>

              {/* Taxpayer Notification Box */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-lg space-y-1.5 text-xs">
                <div className="font-bold text-amber-950 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-amber-700" />
                    Notification to Taxpayer (Programme Update Pending Expert Approval)
                  </span>
                  <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-white border border-amber-300 text-amber-900">
                    {activeMessage.status === 'approved_and_applied_to_code'
                      ? 'Status: Hard-Code Updated'
                      : activeMessage.status === 'rejected_by_expert'
                        ? 'Status: Held by Expert'
                        : 'Status: Pending Expert Approval'}
                  </span>
                </div>
                <p className="text-slate-800 leading-relaxed">
                  {activeMessage.userNotificationSummary}
                </p>
                <div className="pt-1 font-mono text-[11px] font-bold text-emerald-800">
                  Estimated Impact on Your Return: {activeMessage.estimatedUserImpactLabel}
                </div>
              </div>
            </div>

            {/* 2. AI-Suggested Hard-Code Change for Experts to Check */}
            <div className="space-y-2.5 text-xs">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Code2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>
                      AI-Suggested Hard-Code Patch for Chartered Tax Adviser &amp; Engineer Review
                    </span>
                  </div>
                  <span className="font-mono text-[11px] bg-slate-100 text-slate-800 px-2.5 py-1 rounded border border-slate-200">
                    Target: {activeMessage.targetFile} → {activeMessage.targetFunctionOrConstant}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {activeMessage.expertTechnicalRationale}
                </p>
              </div>

              {/* Side-by-Side / Stacked Before & After Hard-Code Diff */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Current Hard-Code */}
                <div className="rounded-lg border border-rose-300 bg-slate-950 text-slate-100 overflow-hidden flex flex-col">
                  <div className="px-3 py-1.5 bg-rose-950/80 border-b border-rose-900 flex items-center justify-between text-[10px] font-mono text-rose-200">
                    <span>− CURRENT HARD-CODED ENGINE ({activeMessage.targetFile})</span>
                    <span>BEFORE</span>
                  </div>
                  <pre className="p-3 font-mono text-[11px] text-rose-200 overflow-x-auto leading-relaxed flex-1">
                    {activeMessage.currentHardCodeSnippet}
                  </pre>
                </div>

                {/* Proposed Hard-Code */}
                <div className="rounded-lg border border-emerald-400 bg-slate-950 text-slate-100 overflow-hidden flex flex-col">
                  <div className="px-3 py-1.5 bg-emerald-950/90 border-b border-emerald-800 flex items-center justify-between text-[10px] font-mono text-emerald-200">
                    <span>+ AI-PROPOSED HARD-CODE UPDATE (FOR EXPERT CHECK)</span>
                    <span>AFTER</span>
                  </div>
                  <pre className="p-3 font-mono text-[11px] text-emerald-200 overflow-x-auto leading-relaxed flex-1">
                    {activeMessage.proposedHardCodeSnippet}
                  </pre>
                </div>
              </div>

              {/* Mirrored Python Decimal Diff */}
              <div className="p-2.5 bg-slate-900 text-slate-200 rounded-lg border border-slate-800 font-mono text-[11px] space-y-1">
                <div className="flex items-center justify-between text-[10px] text-emerald-400">
                  <span className="inline-flex items-center gap-1.5">
                    <FileCode2 className="w-3.5 h-3.5" />
                    Mirrored Python (decimal + pandas) Verification Script Diff
                  </span>
                  <span>/evidence_justifications/</span>
                </div>
                <pre className="text-slate-200 overflow-x-auto">
                  {activeMessage.proposedPythonDecimalDiff}
                </pre>
              </div>
            </div>

            {/* 3. Expert Sign-Off & Programme Update Controls */}
            <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs flex-1 min-w-0">
                {activeMessage.status === 'approved_and_applied_to_code' ? (
                  <div
                    data-testid="patch-approved-status-banner"
                    className="flex items-start gap-2 text-emerald-800 font-semibold leading-relaxed"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <span>
                      Approved by{' '}
                      {activeMessage.expertReviewerName ||
                        'Chartered Tax Adviser (ICAEW #88412)'}{' '}
                      at {activeMessage.expertReviewedAt} — Live{' '}
                      <code className="font-mono bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
                        taxEngine.ts
                      </code>{' '}
                      Updated!
                    </span>
                  </div>
                ) : activeMessage.status === 'rejected_by_expert' ? (
                  <div className="flex items-start gap-2 text-slate-600 font-semibold leading-relaxed">
                    <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <span>
                      Held by Expert Reviewer — Current hard-coded statutory rules retained.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-amber-900 font-semibold leading-relaxed">
                    <UserCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <span>
                      Awaiting Chartered Tax Adviser / Lead Engineer sign-off to deploy into{' '}
                      <code className="font-mono bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
                        taxEngine.ts
                      </code>
                      .
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {activeMessage.status !== 'approved_and_applied_to_code' ? (
                  <>
                    <button
                      type="button"
                      data-testid="expert-approve-patch-btn"
                      onClick={() => onApproveAndApplyPatch(activeMessage.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Expert Approve &amp; Update Hard Code
                    </button>
                    {activeMessage.status !== 'rejected_by_expert' && (
                      <button
                        type="button"
                        onClick={() => onRevertOrRejectPatch(activeMessage.id)}
                        className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                      >
                        Hold / Reject Patch
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => onRevertOrRejectPatch(activeMessage.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Revert Hard-Code Update
                  </button>
                )}

                <button
                  type="button"
                  onClick={onGoToUploadStep}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                >
                  Go to 1. Upload
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
