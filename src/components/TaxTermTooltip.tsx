import React, { useState, useId } from 'react';

export type JargonKey =
  | 'ni'
  | 'write_off'
  | 'deductible'
  | 'relief'
  | 'mileage'
  | 'apportionment'
  | 'aia'
  | 'sipp'
  | 'pre_trading'
  | 'taxable_profit';

export const TAX_JARGON_DEFINITIONS: Record<
  JargonKey,
  { label: string; explanation: string }
> = {
  ni: {
    label: 'National Insurance (NI)',
    explanation:
      'A mandatory contribution sole traders pay alongside Income Tax (6% on profits between £12,570 and £50,270).',
  },
  write_off: {
    label: 'Tax Write-Off',
    explanation:
      'An official business cost subtracted from your income so you only pay tax on what is left over.',
  },
  deductible: {
    label: 'Deductible',
    explanation:
      'An expense HMRC allows you to subtract from your sales before calculating your tax bill.',
  },
  relief: {
    label: 'Tax Relief',
    explanation:
      'A government allowance or subsidy that directly lowers your taxable income or boosts your tax band.',
  },
  mileage: {
    label: '45p/mi Allowance',
    explanation:
      'Flat HMRC rate (45p per mile) that covers fuel, insurance, and wear-and-tear for work drives.',
  },
  apportionment: {
    label: 'Work Share Split',
    explanation:
      'Claiming only the business percentage of an item you use for both work and personal life.',
  },
  aia: {
    label: 'Instant Capital Relief (AIA)',
    explanation:
      'Lets you deduct 100% of work equipment (laptops, tools, desks) in Year 1 instead of spreading it over years.',
  },
  sipp: {
    label: 'Higher-Rate Pension Relief',
    explanation:
      'An extra 20% tax rebate you can claim on your tax return when paying into a personal pension above £50,270 income.',
  },
  pre_trading: {
    label: 'Pre-Trading Relief',
    explanation:
      'Allows you to claim equipment bought up to 7 years before you officially registered as self-employed.',
  },
  taxable_profit: {
    label: 'Taxable Profit',
    explanation:
      'Your total income minus all verified write-offs and reliefs. Your tax bill is calculated on this number.',
  },
};

interface TaxTermTooltipProps {
  termKey: JargonKey;
  children?: React.ReactNode;
}

export const TaxTermTooltip: React.FC<TaxTermTooltipProps> = ({ termKey, children }) => {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const entry = TAX_JARGON_DEFINITIONS[termKey];

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-describedby={open ? tooltipId : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1 border-b border-dashed border-slate-400 hover:border-slate-800 text-inherit font-inherit cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-xs"
      >
        <span>{children ?? entry.label}</span>
      </button>

      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-slate-900 text-white text-xs font-normal leading-snug rounded-lg shadow-lg z-50 pointer-events-none text-left"
        >
          <strong className="block font-semibold text-emerald-400 mb-0.5">
            {entry.label}
          </strong>
          {entry.explanation}
        </span>
      )}
    </span>
  );
};
