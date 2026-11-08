import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Sparkles,
  X,
  RotateCcw,
  Cpu,
  AlertCircle,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import {
  ExpenseItem,
  TaxReliefSubsidy,
  TaxSummaryMetrics,
} from '../utils/taxEngine';

export type GeminiAdvisorModel =
  | 'gemini-4-argon'
  | 'gemini-3.8-flash'
  | 'gemini-3.1-flash-lite';

export interface ChatTurn {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  modelUsed?: GeminiAdvisorModel;
  isStreaming?: boolean;
}

interface TaxAdvisorChatbotProps {
  grossIncome: number;
  strictGuardrail: boolean;
  summary: TaxSummaryMetrics;
  expenses: ExpenseItem[];
  reliefs: TaxReliefSubsidy[];
  isOpen: boolean;
  onToggleOpen: (open: boolean) => void;
  onLogChatAction?: (question: string, modelUsed: string) => void;
}

const MODEL_OPTIONS: Array<{
  id: GeminiAdvisorModel;
  label: string;
}> = [
  {
    id: 'gemini-4-argon',
    label: 'Gemini 4 Argon (Deep Tax Law)',
  },
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash (General)',
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite (Fast)',
  },
];

const STARTER_PROMPTS = [
  {
    chip: 'MacBook 85% cap?',
    question: 'Why is my MacBook Pro capped at 85% until I attach HMRC proof?',
  },
  {
    chip: 'Meal & gift rules?',
    question: 'Can I deduct my £185 Hoxton Grill meal or £340 client hamper?',
  },
  {
    chip: 'Startup gear relief?',
    question: 'How do I claim Pre-Registration Startup Gear (HMRC BIM46351)?',
  },
  {
    chip: 'SA103F box numbers?',
    question: 'Which SA103F boxes do my home office and 45p/mi mileage go into?',
  },
];

/**
 * Renders inline Markdown tokens (**bold**, *italic*, `code`, and [label](url))
 */
function renderInlineMarkdown(text: string, isUser: boolean): React.ReactNode[] {
  const tokenRegex =
    /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, idx) => {
    if (!part) return null;

    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong
          key={idx}
          className={`font-bold ${isUser ? 'text-white' : 'text-slate-950'}`}
        >
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={idx} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }

    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${
            isUser
              ? 'bg-slate-800 text-emerald-300'
              : 'bg-slate-200/80 text-slate-900 border border-slate-300/60'
          }`}
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    const linkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={idx}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline font-medium ${
            isUser
              ? 'text-emerald-300 hover:text-emerald-200'
              : 'text-emerald-700 hover:text-emerald-800'
          }`}
        >
          {linkMatch[1]}
        </a>
      );
    }

    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

/**
 * Renders block-level Markdown (headings, bullet lists, numbered lists, paragraphs)
 * with live streaming cursor support.
 */
const FormattedChatMarkdown: React.FC<{
  text: string;
  isUser: boolean;
  isStreaming?: boolean;
}> = ({ text, isUser, isStreaming }) => {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let listItems: { type: 'ul' | 'ol'; items: string[] } | null = null;

  const flushList = (keyPrefix: string) => {
    if (!listItems) return;
    if (listItems.type === 'ul') {
      blocks.push(
        <ul
          key={`${keyPrefix}-ul`}
          className="list-disc pl-4 space-y-1 my-1.5 marker:text-emerald-600"
        >
          {listItems.items.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {renderInlineMarkdown(item, isUser)}
            </li>
          ))}
        </ul>
      );
    } else {
      blocks.push(
        <ol
          key={`${keyPrefix}-ol`}
          className="list-decimal pl-4 space-y-1 my-1.5 marker:font-semibold marker:text-slate-600"
        >
          {listItems.items.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {renderInlineMarkdown(item, isUser)}
            </li>
          ))}
        </ol>
      );
    }
    listItems = null;
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();

    if (!line) {
      flushList(`empty-${index}`);
      return;
    }

    const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      if (listItems && listItems.type !== 'ul') {
        flushList(`switch-${index}`);
      }
      if (!listItems) {
        listItems = { type: 'ul', items: [] };
      }
      listItems.items.push(bulletMatch[1]);
      return;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      if (listItems && listItems.type !== 'ol') {
        flushList(`switch-${index}`);
      }
      if (!listItems) {
        listItems = { type: 'ol', items: [] };
      }
      listItems.items.push(orderedMatch[1]);
      return;
    }

    flushList(`line-${index}`);

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      blocks.push(
        <div
          key={`h-${index}`}
          className={`font-bold tracking-tight mt-2 mb-1 ${
            isUser ? 'text-white' : 'text-slate-900'
          }`}
        >
          {renderInlineMarkdown(headingMatch[2], isUser)}
        </div>
      );
      return;
    }

    blocks.push(
      <p key={`p-${index}`} className="leading-relaxed my-1 first:mt-0 last:mb-0">
        {renderInlineMarkdown(rawLine, isUser)}
      </p>
    );
  });

  flushList('final');

  return (
    <div className="space-y-1">
      {blocks}
      {isStreaming && (
        <span
          aria-hidden="true"
          className="inline-block w-1.5 h-3.5 ml-1 align-middle bg-emerald-600 animate-pulse rounded-xs"
        />
      )}
    </div>
  );
};

export const TaxAdvisorChatbot: React.FC<TaxAdvisorChatbotProps> = ({
  grossIncome,
  strictGuardrail,
  summary,
  expenses,
  reliefs,
  isOpen,
  onToggleOpen,
  onLogChatAction,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedModel, setSelectedModel] =
    useState<GeminiAdvisorModel>('gemini-4-argon');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const initialGreeting: ChatTurn = {
    id: 'welcome-turn',
    role: 'model',
    text: `Hi Demo User — your **£${grossIncome.toLocaleString()}** ledger is loaded (**£${summary.totalTaxSaved.toLocaleString()}** saved). Ask about any expense, relief, or \`SA103F\` box.`,
    timestamp: 'Ready',
    modelUsed: 'gemini-4-argon',
  };

  const [messages, setMessages] = useState<ChatTurn[]>([initialGreeting]);
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  const sendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || isLoading) return;

    const nowTime = new Date().toTimeString().slice(0, 5);
    const userTurn: ChatTurn = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: nowTime,
    };

    const streamingTurnId = `model-${Date.now() + 1}`;
    const historySnapshot = [...messages, userTurn];

    setMessages([
      ...historySnapshot,
      {
        id: streamingTurnId,
        role: 'model',
        text: '',
        timestamp: nowTime,
        modelUsed: selectedModel,
        isStreaming: true,
      },
    ]);
    setInput('');
    setErrorMessage(null);
    setIsLoading(true);

    // Word-by-word drip queue state so incoming tokens spit out smoothly word by word
    const wordQueue: string[] = [];
    let displayedText = '';
    let streamFinished = false;
    let resolvedModel: GeminiAdvisorModel = selectedModel;

    const dripTimer = window.setInterval(() => {
      if (wordQueue.length > 0) {
        const nextWord = wordQueue.shift()!;
        displayedText += nextWord;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingTurnId
              ? {
                  ...m,
                  text: displayedText,
                  modelUsed: resolvedModel,
                  isStreaming: true,
                }
              : m
          )
        );
      } else if (streamFinished) {
        window.clearInterval(dripTimer);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingTurnId
              ? {
                  ...m,
                  text:
                    displayedText ||
                    'I could not generate a response for that question. Please try rephrasing.',
                  modelUsed: resolvedModel,
                  isStreaming: false,
                }
              : m
          )
        );
        setIsLoading(false);
      }
    }, 24);

    const enqueueTextTokens = (chunkStr: string) => {
      const tokens = chunkStr.match(/\S+\s*|\s+/g) || [chunkStr];
      wordQueue.push(...tokens);
    };

    try {
      const pendingQuestions = expenses
        .filter((e) => e.status === 'needs_clarification')
        .map((e) => ({
          merchant: e.merchantOrDescription,
          amount: e.grossAmount,
          category: e.category,
          question: e.aiQuestion || '',
        }));

      const unclaimedReliefs = reliefs
        .filter((r) => !r.claimed)
        .map((r) => ({
          title: r.title,
          authorityCode: r.authorityCode,
          deduction: r.annualDeductionAmount,
          taxSaving: r.estimatedTaxSaving,
        }));

      const verifiedItemsCount = expenses.filter(
        (e) => e.status === 'verified'
      ).length;
      const packedProofsCount = expenses.filter(
        (e) => e.status === 'verified' && e.proofAttached
      ).length;

      const response = await fetch('/api/gemini/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          messages: historySnapshot.map((m) => ({
            role: m.role,
            text: m.text,
          })),
          taxContext: {
            grossIncome,
            strictGuardrail,
            totalDeductibleExpenses: summary.verifiedExpensesTotal,
            claimedReliefsTotal: summary.claimedReliefsTotal,
            baselineTaxAndNI: summary.BaselineTaxAndNI,
            optimizedTaxAndNI: summary.OptimizedTaxAndNI,
            totalTaxSaved: summary.totalTaxSaved,
            preventedHMRCPenalty: summary.preventedPenaltyGbp,
            pendingQuestions,
            unclaimedReliefs,
            verifiedItemsCount,
            packedProofsCount,
          },
        }),
      });

      if (!response.ok || !response.body) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.error || 'Failed to reach Taximiser AI Adviser.'
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const events = sseBuffer.split('\n\n');
        sseBuffer = events.pop() || '';

        for (const evt of events) {
          const dataLine = evt
            .split('\n')
            .find((line) => line.startsWith('data: '));
          if (!dataLine) continue;

          const payloadStr = dataLine.slice(6).trim();
          if (!payloadStr) continue;

          const parsed = JSON.parse(payloadStr) as {
            chunk?: string;
            done?: boolean;
            modelUsed?: GeminiAdvisorModel;
            error?: string;
          };

          if (parsed.error) {
            throw new Error(parsed.error);
          }

          if (parsed.modelUsed) {
            resolvedModel = parsed.modelUsed;
          }

          if (parsed.chunk) {
            enqueueTextTokens(parsed.chunk);
          }
        }
      }

      streamFinished = true;
      onLogChatAction?.(trimmed, resolvedModel);
    } catch (err: unknown) {
      window.clearInterval(dripTimer);
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to complete Gemini request.';
      setErrorMessage(msg);
      setMessages((prev) =>
        prev.filter((m) => !(m.id === streamingTurnId && !m.text))
      );
      setIsLoading(false);
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        ...initialGreeting,
        id: `welcome-${Date.now()}`,
      },
    ]);
    setErrorMessage(null);
  };

  return (
    <>
      {/* Persistent Bottom-Right Trigger Button */}
      {!isOpen && (
        <div className="fixed bottom-5 right-5 z-40">
          <button
            type="button"
            onClick={() => onToggleOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-lg border border-slate-700 transition-all cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-semibold tracking-tight">
              Ask AI
            </span>
          </button>
        </div>
      )}

      {/* Multi-turn Chat Drawer */}
      {isOpen && (
        <div
          className={`fixed z-50 bg-white border border-slate-200 shadow-2xl flex flex-col transition-all ${
            isExpanded
              ? 'inset-4 sm:inset-8 rounded-2xl'
              : 'bottom-4 right-4 w-[calc(100vw-2rem)] sm:w-[400px] h-[540px] max-h-[calc(100vh-2rem)] rounded-2xl'
          }`}
          role="dialog"
          aria-label="Taximiser AI Adviser Chat"
        >
          {/* Compact Header */}
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-900 text-white rounded-t-2xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <h2 className="text-xs font-bold tracking-tight truncate">
                Taximiser AI
              </h2>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleResetChat}
                title="Reset chat"
                className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                title={isExpanded ? 'Restore size' : 'Expand'}
                className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {isExpanded ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => onToggleOpen(false)}
                title="Close"
                className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Slim Model Selector Bar */}
          <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-slate-400" />
              <select
                id="gemini-model-select"
                aria-label="Gemini Model"
                value={selectedModel}
                onChange={(e) =>
                  setSelectedModel(e.target.value as GeminiAdvisorModel)
                }
                className="text-xs font-medium text-slate-700 bg-transparent focus:outline-none cursor-pointer"
              >
                {MODEL_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-[10px] font-mono text-emerald-700">
              Live Ledger
            </span>
          </div>

          {/* Scrollable Message Thread */}
          <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3 bg-white">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    isUser ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      isUser
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-50 border border-slate-200/80 text-slate-800'
                    }`}
                  >
                    {msg.text ? (
                      <FormattedChatMarkdown
                        text={msg.text}
                        isUser={isUser}
                        isStreaming={msg.isStreaming}
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-slate-400 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                        <span>Thinking...</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {errorMessage && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-red-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-red-800 break-words">{errorMessage}</p>
              </div>
            )}

            <div ref={threadEndRef} />
          </div>

          {/* Compact Starter Chips */}
          {messages.length <= 2 && !isLoading && (
            <div className="px-3.5 py-2 bg-slate-50/60 border-t border-slate-100 flex flex-wrap gap-1.5">
              {STARTER_PROMPTS.map((item) => (
                <button
                  key={item.chip}
                  type="button"
                  onClick={() => sendQuestion(item.question)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-900 border border-slate-200 hover:border-emerald-300 transition-colors cursor-pointer"
                >
                  {item.chip}
                </button>
              ))}
            </div>
          )}

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendQuestion(input);
            }}
            className="p-2.5 border-t border-slate-200 bg-white rounded-b-2xl flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a tax question..."
              disabled={isLoading}
              className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
              className="p-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 text-white transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
