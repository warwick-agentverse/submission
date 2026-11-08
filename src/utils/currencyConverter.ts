/**
 * ============================================================================
 * LIVE FOREIGN CURRENCY TO GBP CONVERTER (src/utils/currencyConverter.ts)
 * ============================================================================
 * UK Self Assessment (Form SA103F) requires all foreign-currency business
 * expenses to be converted into Pound Sterling (GBP) before applying UK tax
 * rules and allowances (HMRC BIM39505).
 *
 * This module fetches live exchange rates against GBP (via `/api/fx/rates` and
 * `open.er-api.com`), detects foreign currencies from OCR text/merchant names
 * (such as HKD / HK$ for Hong Kong receipts), and performs deterministic
 * conversion to GBP.
 * ============================================================================
 */

export type SupportedCurrencyCode =
  | 'GBP'
  | 'HKD'
  | 'USD'
  | 'EUR'
  | 'JPY'
  | 'SGD'
  | 'AUD'
  | 'CAD'
  | 'CHF'
  | 'CNY'
  | 'AED'
  | 'INR';

export interface CurrencyConversionResult {
  originalAmount: number;
  originalCurrency: SupportedCurrencyCode;
  grossAmountGbp: number;
  fxRatePerGbp: number; // Units of foreign currency per £1 GBP (e.g. 10.02 HKD per £1)
  inverseGbpPerUnit: number; // £ GBP per 1 unit of foreign currency (e.g. £0.0998 per 1 HKD)
  fxRateSource: string;
  fxRateTimestamp: string;
  formulaSummary: string;
}

export const CURRENCY_SYMBOLS: Record<SupportedCurrencyCode, string> = {
  GBP: '£',
  HKD: 'HK$',
  USD: 'US$',
  EUR: '€',
  JPY: '¥',
  SGD: 'S$',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'CHF ',
  CNY: '¥',
  AED: 'AED ',
  INR: '₹',
};

export const SUPPORTED_CURRENCIES: SupportedCurrencyCode[] = [
  'GBP',
  'HKD',
  'USD',
  'EUR',
  'JPY',
  'SGD',
  'AUD',
  'CAD',
  'CHF',
  'CNY',
  'AED',
  'INR',
];

/**
 * Baseline HMRC / Bank of England reference spot rates (Units per £1 GBP),
 * updated immediately by live API calls when online.
 */
export const FALLBACK_RATES_PER_GBP: Record<SupportedCurrencyCode, number> = {
  GBP: 1.0,
  HKD: 10.02, // ~£0.0998 per 1 HKD (e.g., HK$ 1,613 -> £161 GBP)
  USD: 1.29,
  EUR: 1.19,
  JPY: 197.5,
  SGD: 1.72,
  AUD: 1.96,
  CAD: 1.79,
  CHF: 1.12,
  CNY: 9.28,
  AED: 4.74,
  INR: 108.4,
};

let cachedRatesPerGbp: Record<string, number> = { ...FALLBACK_RATES_PER_GBP };
let cachedSource = 'Live FX Spot Rate (HMRC / open.er-api.com)';
let cachedTimestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
let lastFetchMs = 0;

/**
 * Fetches live exchange rates with base GBP from `/api/fx/rates` or directly
 * from `https://open.er-api.com/v6/latest/GBP`.
 */
export async function fetchLiveFxRatesToGbp(): Promise<{
  ratesPerGbp: Record<string, number>;
  source: string;
  timestamp: string;
}> {
  const now = Date.now();
  if (now - lastFetchMs < 5 * 60 * 1000 && Object.keys(cachedRatesPerGbp).length > 5) {
    return {
      ratesPerGbp: cachedRatesPerGbp,
      source: cachedSource,
      timestamp: cachedTimestamp,
    };
  }

  // Try backend `/api/fx/rates` first (when running in browser)
  if (typeof window !== 'undefined') {
    try {
      const resp = await fetch('/api/fx/rates');
      if (resp.ok) {
        const data = await resp.json();
        if (data?.ratesPerGbp && typeof data.ratesPerGbp === 'object') {
          cachedRatesPerGbp = { ...FALLBACK_RATES_PER_GBP, ...data.ratesPerGbp };
          cachedSource = String(data.source || 'Live FX API (open.er-api.com)');
          cachedTimestamp = String(
            data.timestamp || new Date().toISOString().slice(0, 16).replace('T', ' ')
          );
          lastFetchMs = now;
          return {
            ratesPerGbp: cachedRatesPerGbp,
            source: cachedSource,
            timestamp: cachedTimestamp,
          };
        }
      }
    } catch {
      // Fall through to direct public endpoint
    }
  }

  // Direct public FX API fetch
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const response = await fetch('https://open.er-api.com/v6/latest/GBP', {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.ok) {
      const json = await response.json();
      if (json?.rates && typeof json.rates === 'object') {
        cachedRatesPerGbp = { ...FALLBACK_RATES_PER_GBP, ...json.rates, GBP: 1 };
        cachedSource = 'Live Exchange Rate API (open.er-api.com)';
        cachedTimestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
        lastFetchMs = now;
      }
    }
  } catch {
    // Keep fallback rates if offline
  }

  return {
    ratesPerGbp: cachedRatesPerGbp,
    source: cachedSource,
    timestamp: cachedTimestamp,
  };
}

/**
 * Deterministically detects the 3-letter currency code from AI-extracted currency,
 * merchant name, or raw OCR text. Handles Hong Kong receipts (`Hong Kong`,
 * `Causeway Bay`, `Kowloon`, `HK$`, `HKD`), US receipts, Euro invoices, etc.
 */
export function detectCurrencyFromTextAndMerchant(
  rawCurrency?: string | null,
  merchant?: string | null,
  rawText?: string | null
): SupportedCurrencyCode {
  const combined = `${rawCurrency || ''} ${merchant || ''} ${rawText || ''}`;
  const upperRaw = (rawCurrency || '').trim().toUpperCase();

  // First check if merchant or raw text strongly signals a foreign jurisdiction/symbol
  // even when OCR defaulted rawCurrency to "GBP"
  if (
    /\b(HONG\s*KONG|CAUSEWAY\s*BAY|KOWLOON|TSIM\s*SHA\s*TSUI|WAN\s*CHAI|CENTRAL,\s*HK|HKD|HK\$)\b/i.test(
      combined
    ) ||
    /\(HK\)/i.test(combined)
  ) {
    return 'HKD';
  }

  if (upperRaw && SUPPORTED_CURRENCIES.includes(upperRaw as SupportedCurrencyCode)) {
    if (upperRaw !== 'GBP') {
      return upperRaw as SupportedCurrencyCode;
    }
  }

  if (/\b(USD|US\$|UNITED STATES|NEW YORK|SAN FRANCISCO|DELAWARE)\b/i.test(combined)) {
    return 'USD';
  }
  if (/\b(EUR|€|EURO|BERLIN|PARIS|AMSTERDAM|DUBLIN)\b/i.test(combined)) {
    return 'EUR';
  }
  if (/\b(JPY|YEN|TOKYO|OSAKA)\b/i.test(combined)) {
    return 'JPY';
  }
  if (/\b(SGD|S\$|SINGAPORE)\b/i.test(combined)) {
    return 'SGD';
  }
  if (/\b(AUD|A\$|SYDNEY|MELBOURNE)\b/i.test(combined)) {
    return 'AUD';
  }
  if (/\b(CAD|C\$|TORONTO|VANCOUVER)\b/i.test(combined)) {
    return 'CAD';
  }
  if (/\b(CHF|ZURICH|GENEVA|SWITZERLAND)\b/i.test(combined)) {
    return 'CHF';
  }
  if (/\b(CNY|RMB|SHANGHAI|SHENZHEN|BEIJING)\b/i.test(combined)) {
    return 'CNY';
  }
  if (/\b(AED|DUBAI|ABU DHABI)\b/i.test(combined)) {
    return 'AED';
  }
  if (/\b(INR|₹|MUMBAI|BENGALURU)\b/i.test(combined)) {
    return 'INR';
  }

  if (upperRaw && SUPPORTED_CURRENCIES.includes(upperRaw as SupportedCurrencyCode)) {
    return upperRaw as SupportedCurrencyCode;
  }

  return 'GBP';
}

/**
 * Converts a foreign-currency amount into GBP using live exchange rates.
 */
export function convertForeignAmountToGbp(
  originalAmount: number,
  currencyCode: string,
  ratesPerGbp: Record<string, number> = cachedRatesPerGbp,
  sourceLabel: string = cachedSource,
  timestampLabel: string = cachedTimestamp
): CurrencyConversionResult {
  const cleanAmount = Math.max(1, Number(originalAmount) || 1);
  const normalizedCode = (
    SUPPORTED_CURRENCIES.includes(currencyCode.toUpperCase() as SupportedCurrencyCode)
      ? currencyCode.toUpperCase()
      : 'GBP'
  ) as SupportedCurrencyCode;

  if (normalizedCode === 'GBP') {
    const rounded = Math.round(cleanAmount);
    return {
      originalAmount: rounded,
      originalCurrency: 'GBP',
      grossAmountGbp: rounded,
      fxRatePerGbp: 1,
      inverseGbpPerUnit: 1,
      fxRateSource: 'Native GBP (£)',
      fxRateTimestamp: timestampLabel,
      formulaSummary: `£${rounded.toLocaleString()} GBP (No FX conversion required)`,
    };
  }

  const ratePerGbp =
    Number(ratesPerGbp[normalizedCode]) ||
    FALLBACK_RATES_PER_GBP[normalizedCode] ||
    1;
  const convertedGbp = Math.max(1, Math.round(cleanAmount / ratePerGbp));
  const inverseGbpPerUnit = Number((1 / ratePerGbp).toFixed(4));
  const symbol = CURRENCY_SYMBOLS[normalizedCode] || `${normalizedCode} `;

  return {
    originalAmount: Math.round(cleanAmount * 100) / 100,
    originalCurrency: normalizedCode,
    grossAmountGbp: convertedGbp,
    fxRatePerGbp: Number(ratePerGbp.toFixed(4)),
    inverseGbpPerUnit,
    fxRateSource: sourceLabel,
    fxRateTimestamp: timestampLabel,
    formulaSummary: `${symbol}${cleanAmount.toLocaleString()} ${normalizedCode} ÷ ${ratePerGbp.toFixed(
      4
    )} (£1 = ${ratePerGbp.toFixed(2)} ${normalizedCode}) = £${convertedGbp.toLocaleString()} GBP`,
  };
}

export function formatOriginalCurrencyBadge(
  originalAmount?: number,
  originalCurrency?: string,
  fxRatePerGbp?: number
): string | null {
  if (!originalCurrency || originalCurrency === 'GBP' || !originalAmount) {
    return null;
  }
  const code = originalCurrency.toUpperCase() as SupportedCurrencyCode;
  const sym = CURRENCY_SYMBOLS[code] || `${code} `;
  const ratePart =
    fxRatePerGbp && fxRatePerGbp > 0
      ? ` (£1 = ${fxRatePerGbp.toFixed(2)} ${code})`
      : '';
  return `${sym}${originalAmount.toLocaleString()} ${code}${ratePart}`;
}
