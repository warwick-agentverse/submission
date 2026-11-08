import React, { useState, useRef, useEffect } from 'react';
import {
  FileSpreadsheet,
  Receipt,
  FileText,
  Car,
  Upload,
  Check,
  ArrowRight,
  Plus,
  Eye,
  Loader2,
  CheckCircle2,
  X,
  ShieldAlert,
  Globe,
  ListChecks,
  SlidersHorizontal,
  Download,
  AlertTriangle,
  Wrench,
  MailQuestion,
  Copy,
} from 'lucide-react';
import {
  DataSourceType,
  ExpenseItem,
  IngestionBatchPreset,
  TaxReliefSubsidy,
  applyCustomSplitToItem,
  computeItemisedBillSummary,
  detectMediaErrorsOnItem,
  fixMediaErrorOnSingleItem,
  getOrBuildItemisedBillLines,
  markMediaErrorAwaitingIssuerOnSingleItem,
  resolveExpenseClarification,
  toggleItemisedLineOnSingleItem,
} from '../utils/taxEngine';
import {
  RealSourceSlot,
  processRealSourceUpload,
} from '../utils/realUploadProcessor';
import { generateSampleSpreadsheetBuffer } from '../utils/spreadsheetParser';
import { runAdversarialForensics } from '../utils/unseenTestingEngine';
import {
  CURRENCY_SYMBOLS,
  FALLBACK_RATES_PER_GBP,
  SUPPORTED_CURRENCIES,
  SupportedCurrencyCode,
  convertForeignAmountToGbp,
  fetchLiveFxRatesToGbp,
} from '../utils/currencyConverter';
import { RawDataPreviewModal } from './RawDataPreviewModal';

interface IngestionHubProps {
  appMode: 'mock' | 'real';
  onSwitchMode: (mode: 'mock' | 'real') => void;
  batches: IngestionBatchPreset[];
  onIngestBatch: (
    batchId: string,
    selectedOptionsByItemId?: Record<string, string>,
    customizedItems?: ExpenseItem[]
  ) => void;
  onIngestAllBatches: (
    selectedOptionsByItemId?: Record<string, string>,
    customizedItems?: ExpenseItem[]
  ) => void;
  onRunUnseenHoldout: () => void;
  unseenHoldoutLoaded: boolean;
  realSlots: RealSourceSlot[];
  uploadingSlotSource: DataSourceType | null;
  onUploadToRealSlot: (sourceType: DataSourceType, file: File) => Promise<void>;
  onCommitRealSlotUpload?: (
    sourceType: DataSourceType,
    fileName: string,
    classifiedExpenses: ExpenseItem[],
    reliefs: TaxReliefSubsidy[],
    modelUsed: string
  ) => void;
  onAddCustomExpense: (item: ExpenseItem) => void;
  currentProfit: number;
  strictGuardrail?: boolean;
  onNextStep?: () => void;
}

interface ActiveUploadSession {
  mode: 'mock_single' | 'mock_all' | 'real_file';
  batchId?: string;
  sourceType?: DataSourceType;
  fileName: string;
  title: string;
  isReadingOcr: boolean;
  items: ExpenseItem[];
  discoveredReliefs: TaxReliefSubsidy[];
  modelUsed: string;
  /** Maps expenseId -> chosen ClarificationOption.id or 'custom_split' | 'itemised_bill' */
  selectedOptions: Record<string, string>;
  /** Maps expenseId -> whether its interactive itemised bill drawer is open */
  openItemisedBills: Record<string, boolean>;
}

export const IngestionHub: React.FC<IngestionHubProps> = ({
  appMode,
  onSwitchMode,
  batches,
  onIngestBatch,
  onIngestAllBatches,
  realSlots,
  uploadingSlotSource,
  onUploadToRealSlot,
  onCommitRealSlotUpload,
  onAddCustomExpense,
  currentProfit,
  onNextStep,
}) => {
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [recentUploadFeedback, setRecentUploadFeedback] = useState<string | null>(
    null
  );
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [previewBatch, setPreviewBatch] = useState<IngestionBatchPreset | null>(
    null
  );

  // Active Upload-Time Work/Split Modal state
  const [activeUploadSession, setActiveUploadSession] =
    useState<ActiveUploadSession | null>(null);
  const [mediaErrorActionPanel, setMediaErrorActionPanel] = useState<
    Record<string, 'custom_fix' | 'issuer_clarify' | null>
  >({});
  const [customFixAmounts, setCustomFixAmounts] = useState<
    Record<string, string>
  >({});
  const [customFixDates, setCustomFixDates] = useState<Record<string, string>>(
    {}
  );
  const [copiedIssuerDraftId, setCopiedIssuerDraftId] = useState<string | null>(
    null
  );

  const showSlideUpToast = (message: string) => {
    setRecentUploadFeedback(message);
    setIsToastVisible(true);
  };

  useEffect(() => {
    if (!isToastVisible) return;
    const hideTimer = window.setTimeout(() => {
      setIsToastVisible(false);
    }, 3200);
    const clearTimer = window.setTimeout(() => {
      setRecentUploadFeedback(null);
    }, 3500);
    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(clearTimer);
    };
  }, [isToastVisible, recentUploadFeedback]);

  const slotFileInputRefs = useRef<
    Record<DataSourceType, HTMLInputElement | null>
  >({
    bank_statement: null,
    receipt: null,
    invoice: null,
    car_journey: null,
  });

  const [description, setDescription] = useState('');
  const [source] = useState<DataSourceType>('receipt');
  const [amount, setAmount] = useState('');
  const [customCurrency, setCustomCurrency] =
    useState<SupportedCurrencyCode>('GBP');
  const [customUsageChoice, setCustomUsageChoice] = useState<
    'work' | 'split' | 'personal'
  >('work');
  const [customSplitPctInput, setCustomSplitPctInput] = useState<number>(50);
  const [liveRatesPerGbp, setLiveRatesPerGbp] = useState<Record<string, number>>({
    ...FALLBACK_RATES_PER_GBP,
  });
  const [liveFxSourceLabel, setLiveFxSourceLabel] = useState<string>(
    'Live FX Rate (open.er-api.com)'
  );
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchLiveFxRatesToGbp().then((fx) => {
      if (mounted) {
        setLiveRatesPerGbp(fx.ratesPerGbp);
        setLiveFxSourceLabel(fx.source);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const remainingBatches = batches.filter((b) => !b.ingested);

  const getSourceIcon = (type: DataSourceType) => {
    switch (type) {
      case 'bank_statement':
        return <FileSpreadsheet className="w-4 h-4 text-slate-600 shrink-0" />;
      case 'receipt':
        return <Receipt className="w-4 h-4 text-slate-600 shrink-0" />;
      case 'invoice':
        return <FileText className="w-4 h-4 text-slate-600 shrink-0" />;
      case 'car_journey':
        return <Car className="w-4 h-4 text-slate-600 shrink-0" />;
    }
  };

  const handleDownloadSampleSpreadsheet = (
    sourceType: DataSourceType,
    format: 'xlsx' | 'csv'
  ) => {
    const sample = generateSampleSpreadsheetBuffer(sourceType, format);
    const blob = new Blob([sample.data as BlobPart], { type: sample.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = sample.fileName;
    a.click();
    URL.revokeObjectURL(url);
    showSlideUpToast(`Downloaded "${sample.fileName}" — click Upload File to test it.`);
  };

  const prepareUploadItems = (
    items: ExpenseItem[],
    preferredMode: 'work' | 'split' | 'personal' = 'work'
  ): {
    preparedItems: ExpenseItem[];
    initialSelections: Record<string, string>;
    openItemisedBills: Record<string, boolean>;
  } => {
    const initialSelections: Record<string, string> = {};
    const openItemisedBills: Record<string, boolean> = {};

    const preparedItems = items.map((rawItem) => {
      const builtLines = getOrBuildItemisedBillLines(rawItem);
      const detectedError =
        rawItem.mediaError ||
        detectMediaErrorsOnItem({
          merchant: rawItem.merchantOrDescription,
          date: rawItem.date,
          sourceDocumentName: rawItem.sourceDocumentName,
          grossAmountGbp: rawItem.grossAmount,
          originalAmount: rawItem.originalAmount,
          originalCurrency: rawItem.originalCurrency,
          fxRatePerGbp: rawItem.fxRatePerGbp,
          rawText: rawItem.rawLineSnippet,
          itemisedLines: builtLines,
        });

      const itemWithBill: ExpenseItem = {
        ...rawItem,
        itemisedBillLines: builtLines,
        mediaError: detectedError,
      };

      if (itemWithBill.status === 'blocked_by_guardrail') {
        return itemWithBill;
      }

      const opts = itemWithBill.clarificationOptions || [];
      if (preferredMode === 'work') {
        if (opts[0]) initialSelections[itemWithBill.id] = opts[0].id;
        itemWithBill.businessPercentage = 100;
      } else if (preferredMode === 'split') {
        const splitOpt = opts.find(
          (o) => o.businessPercentage > 0 && o.businessPercentage < 100
        );
        if (splitOpt) {
          initialSelections[itemWithBill.id] = splitOpt.id;
          itemWithBill.businessPercentage = splitOpt.businessPercentage;
        } else {
          initialSelections[itemWithBill.id] = 'custom_split';
          itemWithBill.businessPercentage = 50;
        }
      } else {
        const zeroOpt =
          opts.find((o) => o.businessPercentage === 0) || opts[opts.length - 1];
        if (zeroOpt) initialSelections[itemWithBill.id] = zeroOpt.id;
        itemWithBill.businessPercentage = 0;
      }

      return itemWithBill;
    });

    return { preparedItems, initialSelections, openItemisedBills };
  };

  // Start Sample Batch Upload -> Opens simple Work/Split Modal
  const handleStartMockBatchUpload = (batch: IngestionBatchPreset) => {
    const { preparedItems, initialSelections, openItemisedBills } =
      prepareUploadItems(batch.itemsToUnlock, 'work');
    setActiveUploadSession({
      mode: 'mock_single',
      batchId: batch.id,
      sourceType: batch.source,
      fileName: batch.fileName,
      title: batch.title,
      isReadingOcr: false,
      items: preparedItems,
      discoveredReliefs: [],
      modelUsed: 'HMRC Decision Tree',
      selectedOptions: initialSelections,
      openItemisedBills,
    });
  };

  // Start Sample "Upload All"
  const handleStartMockUploadAll = () => {
    const uningested = batches.filter((b) => !b.ingested);
    if (uningested.length === 0) return;
    const allItems = uningested.flatMap((b) => b.itemsToUnlock);
    const { preparedItems, initialSelections, openItemisedBills } =
      prepareUploadItems(allItems, 'work');
    setActiveUploadSession({
      mode: 'mock_all',
      fileName: `${uningested.length} files`,
      title: `All ${uningested.length} Sources`,
      isReadingOcr: false,
      items: preparedItems,
      discoveredReliefs: [],
      modelUsed: 'HMRC Decision Tree',
      selectedOptions: initialSelections,
      openItemisedBills,
    });
  };

  // Start Real File Upload -> Opens simple Work/Split Modal while reading OCR
  const handleRealSlotFileChange = async (
    sourceType: DataSourceType,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!onCommitRealSlotUpload) {
      await onUploadToRealSlot(sourceType, file);
      showSlideUpToast(`Uploaded "${file.name}".`);
      return;
    }

    setActiveUploadSession({
      mode: 'real_file',
      sourceType,
      fileName: file.name,
      title: file.name,
      isReadingOcr: true,
      items: [],
      discoveredReliefs: [],
      modelUsed: 'gemini-3.8-flash',
      selectedOptions: {},
      openItemisedBills: {},
    });

    const result = await processRealSourceUpload(
      file,
      sourceType,
      currentProfit
    );

    const { preparedItems, initialSelections, openItemisedBills } =
      prepareUploadItems(result.expenses, 'work');

    setActiveUploadSession({
      mode: 'real_file',
      sourceType,
      fileName: file.name,
      title: file.name,
      isReadingOcr: false,
      items: preparedItems,
      discoveredReliefs: result.reliefs,
      modelUsed: result.modelUsed,
      selectedOptions: initialSelections,
      openItemisedBills,
    });
  };

  const buildFinalizedSessionItems = (
    session: ActiveUploadSession
  ): ExpenseItem[] => {
    let resolved = [...session.items];
    for (const item of resolved) {
      if (item.status === 'blocked_by_guardrail') continue;
      const chosenOptId = session.selectedOptions[item.id];
      if (
        chosenOptId === 'awaiting_issuer' ||
        item.mediaError?.resolutionStatus === 'awaiting_issuer_clarification'
      ) {
        resolved = resolved.map((curr) =>
          curr.id === item.id
            ? markMediaErrorAwaitingIssuerOnSingleItem(curr)
            : curr
        );
      } else if (
        chosenOptId &&
        chosenOptId !== 'custom_split' &&
        chosenOptId !== 'itemised_bill'
      ) {
        resolved = resolveExpenseClarification(resolved, item.id, chosenOptId);
      } else {
        resolved = resolved.map((curr) =>
          curr.id === item.id
            ? applyCustomSplitToItem(curr, curr.businessPercentage)
            : curr
        );
      }
    }
    return resolved;
  };

  const handleFixSessionItemMediaError = (
    expenseId: string,
    correctedAmountGbp: number,
    correctedDate?: string,
    note?: string
  ) => {
    setActiveUploadSession((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        items: prev.items.map((it) =>
          it.id === expenseId
            ? fixMediaErrorOnSingleItem(
                it,
                correctedAmountGbp,
                correctedDate,
                note
              )
            : it
        ),
      };
    });
    setMediaErrorActionPanel((prev) => ({ ...prev, [expenseId]: null }));
    showSlideUpToast(
      `Corrected receipt amount to £${Math.round(correctedAmountGbp).toLocaleString()} GBP.`
    );
  };

  const handleSeekIssuerClarificationInSession = (
    expenseId: string,
    customDraft?: string
  ) => {
    setActiveUploadSession((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        selectedOptions: {
          ...prev.selectedOptions,
          [expenseId]: 'awaiting_issuer',
        },
        items: prev.items.map((it) =>
          it.id === expenseId
            ? markMediaErrorAwaitingIssuerOnSingleItem(it, customDraft)
            : it
        ),
      };
    });
    setMediaErrorActionPanel((prev) => ({ ...prev, [expenseId]: null }));
    showSlideUpToast(
      'Marked as Awaiting Issuer Clarification (£0 held until confirmed).'
    );
  };

  const handleConfirmUploadSession = () => {
    if (!activeUploadSession) return;
    const finalizedItems = buildFinalizedSessionItems(activeUploadSession);

    if (
      activeUploadSession.mode === 'mock_single' &&
      activeUploadSession.batchId
    ) {
      onIngestBatch(
        activeUploadSession.batchId,
        activeUploadSession.selectedOptions,
        finalizedItems
      );
      showSlideUpToast(`Saved "${activeUploadSession.fileName}".`);
    } else if (activeUploadSession.mode === 'mock_all') {
      onIngestAllBatches(activeUploadSession.selectedOptions, finalizedItems);
      showSlideUpToast(`Saved all uploaded sources.`);
    } else if (
      activeUploadSession.mode === 'real_file' &&
      activeUploadSession.sourceType &&
      onCommitRealSlotUpload
    ) {
      onCommitRealSlotUpload(
        activeUploadSession.sourceType,
        activeUploadSession.fileName,
        finalizedItems,
        activeUploadSession.discoveredReliefs,
        activeUploadSession.modelUsed
      );
      showSlideUpToast(`Saved "${activeUploadSession.fileName}".`);
    }

    setActiveUploadSession(null);
  };

  const handleSetAllInUploadSession = (mode: 'work' | 'split' | 'personal') => {
    if (!activeUploadSession) return;
    const { preparedItems, initialSelections } = prepareUploadItems(
      activeUploadSession.items,
      mode
    );
    setActiveUploadSession({
      ...activeUploadSession,
      items: preparedItems,
      selectedOptions: initialSelections,
    });
  };

  const handleUpdateSessionItemCustomSplit = (
    expenseId: string,
    customPct: number
  ) => {
    const clamped = Math.min(100, Math.max(0, Math.round(customPct)));
    setActiveUploadSession((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        selectedOptions: {
          ...prev.selectedOptions,
          [expenseId]: 'custom_split',
        },
        items: prev.items.map((it) =>
          it.id === expenseId
            ? {
                ...it,
                businessPercentage: clamped,
                selectedOptionLabel:
                  clamped === 100
                    ? '100% Work'
                    : clamped === 0
                      ? 'Personal (0%)'
                      : `${clamped}% Split`,
                taxRuleReference: `${clamped}% Business Split (ITTOIA 2005 s.34)`,
              }
            : it
        ),
      };
    });
  };

  const handleToggleSessionItemBillLine = (
    expenseId: string,
    lineId: string
  ) => {
    setActiveUploadSession((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        selectedOptions: {
          ...prev.selectedOptions,
          [expenseId]: 'itemised_bill',
        },
        items: prev.items.map((it) =>
          it.id === expenseId ? toggleItemisedLineOnSingleItem(it, lineId) : it
        ),
      };
    });
  };

  const handleChangeSessionItemCurrency = (
    expenseId: string,
    newCurrency: SupportedCurrencyCode
  ) => {
    setActiveUploadSession((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        items: prev.items.map((it) => {
          if (it.id !== expenseId) return it;
          const nativeAmt = it.originalAmount || it.grossAmount;
          const conv = convertForeignAmountToGbp(
            nativeAmt,
            newCurrency,
            liveRatesPerGbp,
            liveFxSourceLabel
          );
          const updatedLines = getOrBuildItemisedBillLines(it).map((l) => {
            const lineOrig = l.originalAmount || l.amountGbp;
            const lineConv = convertForeignAmountToGbp(
              lineOrig,
              newCurrency,
              liveRatesPerGbp,
              liveFxSourceLabel
            );
            return {
              ...l,
              originalCurrency: newCurrency,
              originalAmount: lineConv.originalAmount,
              amountGbp: lineConv.grossAmountGbp,
            };
          });
          return {
            ...it,
            originalCurrency: conv.originalCurrency,
            originalAmount: conv.originalAmount,
            grossAmount: conv.grossAmountGbp,
            fxRatePerGbp: conv.fxRatePerGbp,
            fxRateSource: conv.fxRateSource,
            itemisedBillLines: updatedLines,
          };
        }),
      };
    });
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      setFormError('Enter a description.');
      return;
    }

    const rawAmountNum = Number(amount);
    if (isNaN(rawAmountNum) || rawAmountNum <= 0) {
      setFormError('Enter a valid amount.');
      return;
    }

    const fxConv = convertForeignAmountToGbp(
      rawAmountNum,
      customCurrency,
      liveRatesPerGbp,
      liveFxSourceLabel
    );
    const computedGross = fxConv.grossAmountGbp;

    const forensics = runAdversarialForensics({
      merchant: trimmedDesc,
      rawText: trimmedDesc,
      date: '07 Nov 2025',
      claimedGrossAmount: computedGross,
    });

    const isBlocked = forensics.isManipulatedOrBlocked;
    const chosenPct = isBlocked
      ? 0
      : customUsageChoice === 'work'
        ? 100
        : customUsageChoice === 'split'
          ? Math.min(99, Math.max(1, Math.round(customSplitPctInput)))
          : 0;

    const chosenLabel = isBlocked
      ? `Blocked (£0)`
      : customUsageChoice === 'work'
        ? '100% Work'
        : customUsageChoice === 'split'
          ? `${chosenPct}% Split`
          : 'Personal (£0)';

    const newItem: ExpenseItem = {
      id: `manual-${Date.now()}`,
      date: '07 Nov',
      merchantOrDescription: trimmedDesc,
      source,
      sourceDocumentName: 'manual_entry.log',
      category: isBlocked ? 'Disallowed' : 'Expense',
      grossAmount: Math.round(computedGross),
      originalAmount: fxConv.originalAmount,
      originalCurrency: fxConv.originalCurrency,
      fxRatePerGbp: fxConv.fxRatePerGbp,
      fxRateSource: fxConv.fxRateSource,
      businessPercentage: chosenPct,
      aiSuggestedPercentage: 100,
      confidencePercent: 95,
      rawLineSnippet: `MANUAL_UPLOAD: "${trimmedDesc}" | AMOUNT: ${fxConv.formulaSummary} | USAGE: ${chosenLabel}`,
      status: isBlocked
        ? 'blocked_by_guardrail'
        : chosenPct === 0
          ? 'personal'
          : 'verified',
      selectedOptionLabel: chosenLabel,
      aiQuestion: `Was "${trimmedDesc}" used for work, split, or personal?`,
      clarificationOptions: [
        {
          id: 'man-100',
          label: '100% Work',
          businessPercentage: 100,
          taxRuleApplied: '100% Business Deduction (ITTOIA s.34)',
        },
        {
          id: `man-${chosenPct > 0 && chosenPct < 100 ? chosenPct : 50}-split`,
          label: `${chosenPct > 0 && chosenPct < 100 ? chosenPct : 50}% Split`,
          businessPercentage: chosenPct > 0 && chosenPct < 100 ? chosenPct : 50,
          taxRuleApplied: 'Mixed-Use Split (HS222)',
        },
        {
          id: 'man-0',
          label: 'Personal',
          businessPercentage: 0,
          taxRuleApplied: 'Excluded Personal Spend',
        },
      ],
      taxRuleReference: isBlocked
        ? forensics.flagTitle
        : chosenPct === 100
          ? '100% Work'
          : chosenPct > 0
            ? `${chosenPct}% Split`
            : 'Personal (£0)',
      guardrailBlockReason: isBlocked ? forensics.explanation : undefined,
      whatWouldChangeMind: isBlocked
        ? 'Provide a valid business VAT invoice within the 2025/26 tax year.'
        : 'Adjust below 100% if item has personal use.',
    };
    newItem.itemisedBillLines = getOrBuildItemisedBillLines(newItem);

    onAddCustomExpense(newItem);
    setDescription('');
    setAmount('');
    setShowCustomForm(false);
    showSlideUpToast(
      isBlocked
        ? `Blocked "${trimmedDesc}" (£0 allowed)`
        : `Added "${trimmedDesc}" (£${newItem.grossAmount} GBP · ${chosenLabel})`
    );
  };

  return (
    <section
      id="ingest-data"
      aria-labelledby="ingest-heading"
      className="bg-white border border-slate-200 rounded-xl p-5"
    >
      {/* Simple, Clean Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div>
            <h2 id="ingest-heading" className="text-sm font-bold text-slate-900">
              1. Upload Expenses
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload a bank statement, receipt, invoice, or mileage log (.xlsx, .csv, PDF, or photo).
            </p>
          </div>

          <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg text-xs shrink-0">
            <button
              type="button"
              onClick={() => onSwitchMode('mock')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                appMode === 'mock'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Sample Data
            </button>
            <button
              type="button"
              onClick={() => onSwitchMode('real')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                appMode === 'real'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Upload Your File
            </button>
          </div>
        </div>

        {appMode === 'mock' && remainingBatches.length > 0 && (
          <button
            type="button"
            onClick={handleStartMockUploadAll}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Upload All ({remainingBatches.length})
          </button>
        )}
      </div>

      {/* Toast */}
      {recentUploadFeedback && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-lg border border-slate-700 transition-all duration-300 ease-out ${
            isToastVisible
              ? 'translate-y-0 opacity-100'
              : 'translate-y-4 opacity-0 pointer-events-none'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{recentUploadFeedback}</span>
          <button
            type="button"
            onClick={() => {
              setIsToastVisible(false);
              setRecentUploadFeedback(null);
            }}
            aria-label="Dismiss notification"
            className="p-0.5 text-slate-400 hover:text-white rounded cursor-pointer ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* SAMPLE DATA LIST */}
      {appMode === 'mock' ? (
        <div className="divide-y divide-slate-100">
          {batches.map((batch) => (
            <div
              key={batch.id}
              className="py-3 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                  {getSourceIcon(batch.source)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900 truncate">
                    {batch.title}
                  </h3>
                  <p className="text-xs text-slate-400 truncate">
                    {batch.subtitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <span className="text-xs font-mono text-slate-400">
                  {batch.itemsToUnlock.length} {batch.itemsToUnlock.length === 1 ? 'item' : 'items'}
                </span>

                <button
                  type="button"
                  onClick={() => setPreviewBatch(batch)}
                  title="Preview file"
                  className="p-1.5 text-slate-400 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>

                {batch.ingested ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                    Uploaded
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleStartMockBatchUpload(batch)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-white border border-slate-200 hover:bg-slate-900 hover:text-white hover:border-slate-900 rounded-lg transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* LIVE FILE UPLOAD LIST */
        <div className="divide-y divide-slate-100">
          {realSlots.map((slot) => {
            const isUploadingThis = uploadingSlotSource === slot.source;
            const hasUploaded = slot.uploadedFiles.length > 0;

            return (
              <div
                key={slot.id}
                className="py-3.5 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                    {getSourceIcon(slot.source)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {slot.title}
                    </h3>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {hasUploaded
                        ? `Uploaded: ${slot.uploadedFiles.join(', ')} (${slot.extractedCount} items)`
                        : slot.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {hasUploaded && (
                    <span className="text-xs font-mono text-slate-400">
                      {slot.extractedCount}{' '}
                      {slot.extractedCount === 1 ? 'item' : 'items'}
                    </span>
                  )}

                  <div className="hidden sm:inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadSampleSpreadsheet(slot.source, 'xlsx')
                      }
                      title={`Download sample .xlsx for ${slot.title}`}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono font-medium text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      .xlsx
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadSampleSpreadsheet(slot.source, 'csv')
                      }
                      title={`Download sample .csv for ${slot.title}`}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono font-medium text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      .csv
                    </button>
                  </div>

                  <input
                    ref={(el) => {
                      slotFileInputRefs.current[slot.source] = el;
                    }}
                    type="file"
                    accept={slot.acceptTypes}
                    onChange={(e) => handleRealSlotFileChange(slot.source, e)}
                    className="hidden"
                    aria-label={`Upload file for ${slot.title}`}
                  />

                  <button
                    type="button"
                    disabled={uploadingSlotSource !== null}
                    onClick={() =>
                      slotFileInputRefs.current[slot.source]?.click()
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                      isUploadingThis
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : hasUploaded
                          ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                    }`}
                  >
                    {isUploadingThis ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                        Reading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        {hasUploaded ? 'Upload Another' : 'Upload File'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Bar */}
      <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setShowCustomForm(!showCustomForm)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          {showCustomForm ? 'Close' : 'Add Expense Manually'}
        </button>

        {onNextStep && (
          <button
            type="button"
            onClick={onNextStep}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            Next: Splits
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Manual Expense Entry */}
      {showCustomForm && (
        <form
          onSubmit={handleManualSubmit}
          className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
        >
          <div className="sm:col-span-3">
            <input
              id="quick-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Expense name (e.g. Laptop)"
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400"
            />
          </div>
          <div className="sm:col-span-3 flex items-center gap-1">
            <select
              aria-label="Currency"
              value={customCurrency}
              onChange={(e) =>
                setCustomCurrency(e.target.value as SupportedCurrencyCode)
              }
              className="px-2 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400 cursor-pointer"
            >
              {SUPPORTED_CURRENCIES.map((curCode) => (
                <option key={curCode} value={curCode}>
                  {curCode}
                </option>
              ))}
            </select>
            <input
              id="quick-amount"
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Amount (${CURRENCY_SYMBOLS[customCurrency] || '£'})`}
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400"
            />
          </div>
          <div className="sm:col-span-4 flex items-center gap-1.5">
            <div className="flex-1 flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
              {(
                [
                  { id: 'work', label: '100% Work' },
                  { id: 'split', label: `${customSplitPctInput || 50}% Split` },
                  { id: 'personal', label: 'Personal' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCustomUsageChoice(opt.id)}
                  className={`flex-1 py-1 px-1.5 rounded-md font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    customUsageChoice === opt.id
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {customUsageChoice === 'split' && (
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="number"
                  min={1}
                  max={99}
                  aria-label="Custom split percentage"
                  value={customSplitPctInput}
                  onChange={(e) =>
                    setCustomSplitPctInput(Number(e.target.value) || 50)
                  }
                  className="w-14 px-2 py-1 text-xs font-mono font-bold text-slate-900 bg-white border border-emerald-400 rounded-lg text-center"
                />
                <span className="text-xs font-mono font-bold text-slate-600">
                  %
                </span>
              </div>
            )}
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="w-full px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Add
            </button>
          </div>
          {formError && (
            <p
              role="alert"
              className="sm:col-span-12 text-xs font-medium text-red-600"
            >
              {formError}
            </p>
          )}
        </form>
      )}

      {/* SIMPLE, CLEAN WORK / SPLIT / PERSONAL MODAL */}
      {activeUploadSession &&
        (() => {
          const selectableItems = activeUploadSession.items.filter(
            (i) => i.status !== 'blocked_by_guardrail'
          );
          const allBlocked =
            !activeUploadSession.isReadingOcr &&
            activeUploadSession.items.length > 0 &&
            selectableItems.length === 0;

          return (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="upload-decision-tree-title"
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
            >
              <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-5 shadow-xl space-y-4 max-h-[88vh] flex flex-col">
                {/* Clean Modal Header */}
                <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100 shrink-0">
                  <div>
                    <h3
                      id="upload-decision-tree-title"
                      className="text-base font-bold text-slate-900"
                    >
                      {allBlocked
                        ? 'Expense Blocked by UK Tax Rules (£0)'
                        : 'How was this expense used?'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {allBlocked
                        ? 'Client entertaining and gifts over £50 are not deductible in the UK.'
                        : 'Choose Work, Split %, or Personal for each item below.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveUploadSession(null)}
                    aria-label="Cancel upload"
                    className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Only show "Set All" bar when uploading multiple items */}
                {!activeUploadSession.isReadingOcr &&
                  selectableItems.length > 1 && (
                    <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs shrink-0">
                      <span className="font-medium text-slate-600">
                        Apply to all {selectableItems.length} items:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSetAllInUploadSession('work')}
                          className="px-2.5 py-1 text-xs font-semibold rounded-md bg-white border border-slate-200 text-slate-800 hover:bg-emerald-700 hover:text-white transition-colors cursor-pointer"
                        >
                          All Work (100%)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetAllInUploadSession('split')}
                          className="px-2.5 py-1 text-xs font-semibold rounded-md bg-white border border-slate-200 text-slate-800 hover:bg-slate-900 hover:text-white transition-colors cursor-pointer"
                        >
                          All Split (50%)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetAllInUploadSession('personal')}
                          className="px-2.5 py-1 text-xs font-semibold rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                        >
                          All Personal
                        </button>
                      </div>
                    </div>
                  )}

                {/* Items List */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {activeUploadSession.isReadingOcr ? (
                    <div className="py-10 text-center space-y-2">
                      <Loader2 className="w-6 h-6 animate-spin text-emerald-700 mx-auto" />
                      <p className="text-sm font-bold text-slate-900">
                        Reading &ldquo;{activeUploadSession.fileName}&rdquo;...
                      </p>
                      <p className="text-xs text-slate-500">
                        Extracting amount, currency, and receipt items.
                      </p>
                    </div>
                  ) : (
                    activeUploadSession.items.map((item) => {
                      const isBlocked = item.status === 'blocked_by_guardrail';
                      const chosenOptionId =
                        activeUploadSession.selectedOptions[item.id] ||
                        item.clarificationOptions?.[0]?.id;
                      const chosenOpt = item.clarificationOptions?.find(
                        (o) => o.id === chosenOptionId
                      );
                      const rawPct = isBlocked
                        ? 0
                        : chosenOpt?.businessPercentage ??
                          item.businessPercentage;

                      const billLines =
                        item.itemisedBillLines &&
                        item.itemisedBillLines.length > 0
                          ? item.itemisedBillLines
                          : getOrBuildItemisedBillLines(item);
                      const billSummary = computeItemisedBillSummary(
                        billLines,
                        item.grossAmount
                      );
                      const isBillOpen = Boolean(
                        activeUploadSession.openItemisedBills[item.id]
                      );

                      const isSplitMode =
                        !isBlocked &&
                        (chosenOptionId === 'custom_split' ||
                          chosenOptionId === 'itemised_bill' ||
                          (rawPct > 0 && rawPct < 100));

                      const hasForeignCurrency =
                        item.originalCurrency &&
                        item.originalCurrency !== 'GBP';
                      const origCurSymbol =
                        (item.originalCurrency &&
                          CURRENCY_SYMBOLS[
                            item.originalCurrency as SupportedCurrencyCode
                          ]) ||
                        '';

                      return (
                        <div
                          key={item.id}
                          className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white"
                        >
                          {/* Row 1: Merchant + Amount + Tax Saved */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-slate-900">
                                {item.merchantOrDescription}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {isBlocked
                                  ? item.guardrailBlockReason ||
                                    'Disallowed under UK tax rules (£0 deductible).'
                                  : item.aiQuestion ||
                                    'Was this expense for work, split, or personal?'}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                                £{item.grossAmount.toLocaleString()}
                              </div>
                              {hasForeignCurrency ? (
                                <div
                                  data-testid={`fx-badge-${item.id}`}
                                  className="text-[11px] font-mono text-teal-700 font-semibold"
                                >
                                  {origCurSymbol}
                                  {(
                                    item.originalAmount ?? item.grossAmount
                                  ).toLocaleString()}{' '}
                                  {item.originalCurrency}
                                </div>
                              ) : (
                                <div className="text-[11px] font-mono text-slate-400">
                                  {item.category}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Row 1.5: Media Error Flagged Banner (Fix Mistake or Seek Clarification from Issuer) */}
                          {item.mediaError?.hasError && (
                            <div
                              data-testid={`media-error-banner-${item.id}`}
                              className={`rounded-xl border p-3 space-y-2.5 text-xs ${
                                item.mediaError.resolutionStatus ===
                                'fixed_by_user'
                                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                                  : item.mediaError.resolutionStatus ===
                                      'awaiting_issuer_clarification'
                                    ? 'bg-sky-50/80 border-sky-200 text-sky-950'
                                    : 'bg-amber-50/90 border-amber-300 text-amber-950'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2.5">
                                <div className="flex items-start gap-2 min-w-0">
                                  <AlertTriangle
                                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                                      item.mediaError.resolutionStatus ===
                                      'fixed_by_user'
                                        ? 'text-emerald-700'
                                        : item.mediaError.resolutionStatus ===
                                            'awaiting_issuer_clarification'
                                          ? 'text-sky-700'
                                          : 'text-amber-700'
                                    }`}
                                  />
                                  <div className="space-y-0.5 min-w-0">
                                    <div className="font-bold flex flex-wrap items-center gap-1.5">
                                      <span>{item.mediaError.title}</span>
                                      {item.mediaError.resolutionStatus ===
                                        'fixed_by_user' && (
                                        <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-emerald-200/80 text-emerald-900 rounded">
                                          FIXED (£{item.grossAmount})
                                        </span>
                                      )}
                                      {item.mediaError.resolutionStatus ===
                                        'awaiting_issuer_clarification' && (
                                        <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-sky-200/80 text-sky-900 rounded">
                                          AWAITING ISSUER (£0 HELD)
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] leading-relaxed opacity-90">
                                      {item.mediaError.description}
                                    </p>
                                    {item.mediaError.resolutionNote && (
                                      <p className="text-[11px] font-mono font-semibold mt-1">
                                        Status: {item.mediaError.resolutionNote}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Action Buttons: Fix Mistake OR Seek Clarification from Issuer */}
                              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                {item.mediaError.suggestedCorrectedAmountGbp !==
                                  item.grossAmount && (
                                  <button
                                    type="button"
                                    data-testid={`fix-media-error-btn-${item.id}`}
                                    onClick={() =>
                                      handleFixSessionItemMediaError(
                                        item.id,
                                        item.mediaError!
                                          .suggestedCorrectedAmountGbp,
                                        undefined,
                                        `Corrected from £${item.mediaError!.claimedAmountGbp} to verified line-item sum £${item.mediaError!.suggestedCorrectedAmountGbp}`
                                      )
                                    }
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Wrench className="w-3.5 h-3.5" />
                                    Fix Mistake (Use £
                                    {item.mediaError.suggestedCorrectedAmountGbp.toLocaleString()}
                                    )
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setCustomFixAmounts((prev) => ({
                                      ...prev,
                                      [item.id]: String(
                                        item.mediaError
                                          ?.suggestedCorrectedAmountGbp ||
                                          item.grossAmount
                                      ),
                                    }));
                                    setCustomFixDates((prev) => ({
                                      ...prev,
                                      [item.id]: item.date,
                                    }));
                                    setMediaErrorActionPanel((prev) => ({
                                      ...prev,
                                      [item.id]:
                                        prev[item.id] === 'custom_fix'
                                          ? null
                                          : 'custom_fix',
                                    }));
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Wrench className="w-3 h-3 text-slate-600" />
                                  {mediaErrorActionPanel[item.id] ===
                                  'custom_fix'
                                    ? 'Hide Manual Fix'
                                    : 'Edit / Fix Mistake'}
                                </button>

                                <button
                                  type="button"
                                  data-testid={`seek-issuer-clarification-btn-${item.id}`}
                                  onClick={() =>
                                    setMediaErrorActionPanel((prev) => ({
                                      ...prev,
                                      [item.id]:
                                        prev[item.id] === 'issuer_clarify'
                                          ? null
                                          : 'issuer_clarify',
                                    }))
                                  }
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-sky-900 bg-white border border-sky-300 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                                >
                                  <MailQuestion className="w-3.5 h-3.5 text-sky-700" />
                                  Seek Clarification from Issuer
                                </button>
                              </div>

                              {/* Inline Panel 1: Manual Fix Mistake Form */}
                              {mediaErrorActionPanel[item.id] ===
                                'custom_fix' && (
                                <div className="p-2.5 bg-white border border-slate-200 rounded-lg flex flex-wrap items-center gap-2">
                                  <label className="text-[11px] font-semibold text-slate-700">
                                    Corrected Amount (£ GBP):
                                  </label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={
                                      customFixAmounts[item.id] ??
                                      String(
                                        item.mediaError
                                          .suggestedCorrectedAmountGbp
                                      )
                                    }
                                    onChange={(e) =>
                                      setCustomFixAmounts((prev) => ({
                                        ...prev,
                                        [item.id]: e.target.value,
                                      }))
                                    }
                                    className="w-24 px-2 py-1 text-xs font-mono font-bold text-slate-900 border border-slate-300 rounded"
                                  />
                                  <label className="text-[11px] font-semibold text-slate-700">
                                    Date:
                                  </label>
                                  <input
                                    type="text"
                                    value={
                                      customFixDates[item.id] ?? item.date
                                    }
                                    onChange={(e) =>
                                      setCustomFixDates((prev) => ({
                                        ...prev,
                                        [item.id]: e.target.value,
                                      }))
                                    }
                                    className="w-24 px-2 py-1 text-xs font-mono text-slate-900 border border-slate-300 rounded"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleFixSessionItemMediaError(
                                        item.id,
                                        Number(
                                          customFixAmounts[item.id] ||
                                            item.mediaError!
                                              .suggestedCorrectedAmountGbp
                                        ),
                                        customFixDates[item.id] || item.date,
                                        `Manually corrected by user to £${
                                          customFixAmounts[item.id] ||
                                          item.mediaError!
                                            .suggestedCorrectedAmountGbp
                                        } (${customFixDates[item.id] || item.date})`
                                      )
                                    }
                                    className="px-3 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
                                  >
                                    Apply Fix
                                  </button>
                                </div>
                              )}

                              {/* Inline Panel 2: Seek Clarification from Issuer */}
                              {mediaErrorActionPanel[item.id] ===
                                'issuer_clarify' && (
                                <div className="p-3 bg-white border border-sky-200 rounded-lg space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-bold text-slate-800">
                                      Draft Clarification Request to Merchant /
                                      Issuer:
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard?.writeText(
                                          item.mediaError!
                                            .issuerClarificationDraft
                                        );
                                        setCopiedIssuerDraftId(item.id);
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                                    >
                                      <Copy className="w-3 h-3" />
                                      {copiedIssuerDraftId === item.id
                                        ? 'Copied!'
                                        : 'Copy Message'}
                                    </button>
                                  </div>
                                  <pre className="p-2 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono whitespace-pre-wrap text-slate-700 leading-relaxed">
                                    {item.mediaError.issuerClarificationDraft}
                                  </pre>
                                  <div className="flex items-center justify-between gap-2 pt-1">
                                    <span className="text-[11px] text-slate-500">
                                      Holds deduction at £0 until merchant
                                      confirms or issues an amended receipt.
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSeekIssuerClarificationInSession(
                                          item.id
                                        )
                                      }
                                      className="px-3 py-1.5 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg cursor-pointer shrink-0"
                                    >
                                      Hold Claim &amp; Await Issuer Reply (£0)
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Row 2: 3 Simple Choice Buttons (or Blocked Notice) */}
                          {isBlocked ? (
                            <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-800 flex items-center gap-2">
                              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                              <span>
                                Blocked by HMRC Rules (£0 allowed) — Cannot be
                                claimed as a business deduction.
                              </span>
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 gap-2">
                              {/* 100% Work */}
                              <button
                                type="button"
                                onClick={() => {
                                  const workOpt =
                                    item.clarificationOptions?.find(
                                      (o) => o.businessPercentage === 100
                                    ) || item.clarificationOptions?.[0];
                                  if (workOpt) {
                                    setActiveUploadSession((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            selectedOptions: {
                                              ...prev.selectedOptions,
                                              [item.id]: workOpt.id,
                                            },
                                            items: prev.items.map((it) =>
                                              it.id === item.id
                                                ? {
                                                    ...it,
                                                    businessPercentage: 100,
                                                  }
                                                : it
                                            ),
                                          }
                                        : null
                                    );
                                  }
                                }}
                                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                                  rawPct === 100 && !isBillOpen
                                    ? 'bg-emerald-700 text-white border-emerald-700'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                100% Work
                              </button>

                              {/* Split % */}
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateSessionItemCustomSplit(
                                    item.id,
                                    rawPct > 0 && rawPct < 100 ? rawPct : 50
                                  )
                                }
                                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                                  isSplitMode || isBillOpen
                                    ? 'bg-emerald-700 text-white border-emerald-700'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                {isSplitMode ? `${rawPct}% Split` : 'Split %'}
                              </button>

                              {/* Personal (£0) */}
                              <button
                                type="button"
                                onClick={() => {
                                  const zeroOpt =
                                    item.clarificationOptions?.find(
                                      (o) => o.businessPercentage === 0
                                    );
                                  if (zeroOpt) {
                                    setActiveUploadSession((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            selectedOptions: {
                                              ...prev.selectedOptions,
                                              [item.id]: zeroOpt.id,
                                            },
                                            items: prev.items.map((it) =>
                                              it.id === item.id
                                                ? {
                                                    ...it,
                                                    businessPercentage: 0,
                                                  }
                                                : it
                                            ),
                                          }
                                        : null
                                    );
                                  } else {
                                    handleUpdateSessionItemCustomSplit(
                                      item.id,
                                      0
                                    );
                                  }
                                }}
                                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                                  rawPct === 0
                                    ? 'bg-slate-800 text-white border-slate-800'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                Personal (£0)
                              </button>
                            </div>
                          )}

                          {/* Row 3: Progressive Disclosure — Only show Slider / Itemised Bill when Split is chosen or clicked */}
                          {!isBlocked && (
                            <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                              {isSplitMode ? (
                                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                                  <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                  <span className="text-slate-600 font-medium">
                                    Work %:
                                  </span>
                                  <input
                                    type="range"
                                    min={1}
                                    max={99}
                                    value={rawPct}
                                    onChange={(e) =>
                                      handleUpdateSessionItemCustomSplit(
                                        item.id,
                                        Number(e.target.value)
                                      )
                                    }
                                    className="w-24 accent-emerald-700 cursor-pointer"
                                  />
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    aria-label={`Custom split percentage for ${item.merchantOrDescription}`}
                                    value={rawPct}
                                    onChange={(e) =>
                                      handleUpdateSessionItemCustomSplit(
                                        item.id,
                                        Number(e.target.value)
                                      )
                                    }
                                    className="w-12 px-1 py-0.5 text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded text-center"
                                  />
                                  <span className="font-mono font-bold text-slate-600">
                                    %
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400">
                                  {rawPct === 100
                                    ? '100% business use selected'
                                    : 'Personal expense (excluded from return)'}
                                </span>
                              )}

                              <div className="flex items-center gap-2">
                                {/* Currency switcher */}
                                <div className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                                  <Globe className="w-3 h-3 text-slate-400" />
                                  <select
                                    aria-label={`Receipt currency for ${item.merchantOrDescription}`}
                                    value={item.originalCurrency || 'GBP'}
                                    onChange={(e) =>
                                      handleChangeSessionItemCurrency(
                                        item.id,
                                        e.target.value as SupportedCurrencyCode
                                      )
                                    }
                                    className="font-mono font-semibold bg-transparent text-slate-600 hover:text-slate-900 cursor-pointer"
                                  >
                                    {SUPPORTED_CURRENCIES.map((curCode) => (
                                      <option key={curCode} value={curCode}>
                                        {curCode}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {/* Toggle Itemised Receipt Checklist */}
                                <button
                                  type="button"
                                  data-testid={`toggle-itemised-bill-${item.id}`}
                                  onClick={() =>
                                    setActiveUploadSession((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            openItemisedBills: {
                                              ...prev.openItemisedBills,
                                              [item.id]:
                                                !prev.openItemisedBills[item.id],
                                            },
                                          }
                                        : null
                                    )
                                  }
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                                    isBillOpen
                                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  <ListChecks className="w-3.5 h-3.5 text-emerald-700" />
                                  {isBillOpen
                                    ? 'Hide Receipt Items'
                                    : `Pick Receipt Items (${billLines.length})`}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Interactive Receipt Lines Checklist (only when opened) */}
                          {!isBlocked && isBillOpen && (
                            <div
                              data-testid={`itemised-bill-panel-${item.id}`}
                              className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2"
                            >
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-700">
                                  Click receipt items used for business:
                                </span>
                                <span className="font-mono font-bold text-emerald-800">
                                  £{billSummary.businessGbp.toFixed(0)} / £
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
                                      handleToggleSessionItemBillLine(
                                        item.id,
                                        line.id
                                      )
                                    }
                                    className={`w-full px-3 py-2 flex items-center justify-between gap-3 text-left text-xs transition-colors cursor-pointer ${
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
                    })
                  )}
                </div>

                {/* Simple Modal Footer */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveUploadSession(null)}
                    className="px-3.5 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={activeUploadSession.isReadingOcr}
                    onClick={handleConfirmUploadSession}
                    data-testid="confirm-upload-classifications-btn"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {allBlocked ? 'Done' : 'Save & Finish Upload'}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      <RawDataPreviewModal
        batch={previewBatch}
        onClose={() => setPreviewBatch(null)}
        onIngestBatch={(id) => {
          const target = batches.find((b) => b.id === id);
          setPreviewBatch(null);
          if (target) {
            handleStartMockBatchUpload(target);
          }
        }}
      />
    </section>
  );
};
