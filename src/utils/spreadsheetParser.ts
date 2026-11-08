import * as XLSX from 'xlsx';
import { DataSourceType, calculateHMRCMileageGross } from './taxEngine';
import {
  SupportedCurrencyCode,
  detectCurrencyFromTextAndMerchant,
} from './currencyConverter';

export interface ParsedSpreadsheetItemisedLine {
  description: string;
  originalAmount: number;
  isBusiness: boolean;
  categoryTag: string;
}

export interface ParsedSpreadsheetExpenseRow {
  date: string;
  merchantOrDescription: string;
  category: string;
  sourceType: DataSourceType;
  originalCurrency: SupportedCurrencyCode;
  originalAmount: number;
  grossAmount: number;
  miles: number | null;
  aiSuggestedPercentage: number;
  confidencePercent: number;
  highAuditRisk: boolean;
  rawLineSnippet: string;
  needsClarification: boolean;
  isDisallowed: boolean;
  disallowedReason: string | null;
  aiContextNote: string;
  aiQuestion: string;
  splitOptionPercentage: number;
  taxRuleReference: string;
  whatWouldChangeMind: string;
  itemisedLines?: ParsedSpreadsheetItemisedLine[];
}

export interface SpreadsheetParseOutput {
  items: ParsedSpreadsheetExpenseRow[];
  normalizedCsvText: string;
  sheetNames: string[];
  totalRowsRead: number;
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function isSpreadsheetFileName(fileName: string): boolean {
  const lower = fileName.trim().toLowerCase();
  return (
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xls') ||
    lower.endsWith('.csv') ||
    lower.endsWith('.tsv')
  );
}

export function isExcelBinaryFileName(fileName: string): boolean {
  const lower = fileName.trim().toLowerCase();
  return lower.endsWith('.xlsx') || lower.endsWith('.xls');
}

function formatNormalizedDate(rawVal: unknown): string {
  if (rawVal instanceof Date && !isNaN(rawVal.getTime())) {
    const day = String(rawVal.getDate()).padStart(2, '0');
    const mon = MONTH_NAMES[rawVal.getMonth()] || 'Nov';
    return `${day} ${mon}`;
  }

  if (typeof rawVal === 'number' && rawVal > 20000 && rawVal < 80000) {
    // Excel serial date
    const utcDays = Math.floor(rawVal - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    if (!isNaN(d.getTime())) {
      const day = String(d.getUTCDate()).padStart(2, '0');
      const mon = MONTH_NAMES[d.getUTCMonth()] || 'Nov';
      return `${day} ${mon}`;
    }
  }

  const str = String(rawVal ?? '').trim();
  if (!str) return '07 Nov';

  // ISO YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const monthIdx = Math.max(0, Math.min(11, Number(isoMatch[2]) - 1));
    const day = String(Number(isoMatch[3])).padStart(2, '0');
    return year >= 2028 || year <= 2021
      ? `${day} ${MONTH_NAMES[monthIdx]} ${year}`
      : `${day} ${MONTH_NAMES[monthIdx]}`;
  }

  // UK DD/MM/YYYY or DD-MM-YYYY
  const ukMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (ukMatch) {
    const day = String(Number(ukMatch[1])).padStart(2, '0');
    const monthIdx = Math.max(0, Math.min(11, Number(ukMatch[2]) - 1));
    const rawYear = Number(ukMatch[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    return year >= 2028 || year <= 2021
      ? `${day} ${MONTH_NAMES[monthIdx]} ${year}`
      : `${day} ${MONTH_NAMES[monthIdx]}`;
  }

  return str.slice(0, 16);
}

function parseNumericCell(val: unknown): number | null {
  if (typeof val === 'number' && !isNaN(val)) {
    return val;
  }
  const str = String(val ?? '').trim();
  if (!str) return null;

  // Handle accounting parentheses e.g. "(1,250.00)"
  const isParenNegative = /^\(.*\)$/.test(str);
  const cleaned = str.replace(/[^0-9.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const num = Number(cleaned);
  if (isNaN(num)) return null;
  return isParenNegative ? -Math.abs(num) : num;
}

function inferCategoryFromMerchantAndSource(
  merchant: string,
  rawCategory: string,
  sourceType: DataSourceType
): string {
  const cleanCat = rawCategory.trim();
  if (
    cleanCat &&
    !/^(debit|credit|card|payment|purchase|pos|faster payment|bacs|dd|direct debit)$/i.test(
      cleanCat
    )
  ) {
    return cleanCat;
  }

  if (sourceType === 'car_journey') return 'Mileage';

  const lower = `${merchant} ${cleanCat}`.toLowerCase();
  if (/\b(miles|mileage|45p|journey|trip|gps)\b/.test(lower)) {
    return 'Mileage';
  }
  if (
    /\b(apple|macbook|dell|lenovo|prusa|printer|camera|sony|monitor|ipad|wacom|tool|drill|hardware|laptop)\b/.test(
      lower
    )
  ) {
    return 'Equipment';
  }
  if (
    /\b(adobe|figma|github|openai|aws|google cloud|microsoft|notion|slack|xero|quickbooks|hosting|saas|software|subscription)\b/.test(
      lower
    )
  ) {
    return 'Software';
  }
  if (
    /\b(trainline|lner|gwr|uber|eurostar|british airways|cathay|hotel|premier inn|hilton|airbnb|flight|rail|taxi|parking)\b/.test(
      lower
    )
  ) {
    return 'Travel';
  }
  if (
    /\b(vodafone|ee|o2|three|bt|virgin media|hyperoptic|broadband|mobile|phone|sim|data)\b/.test(
      lower
    )
  ) {
    return 'Phone & Data';
  }
  if (
    /\b(accountant|solicitor|legal|accounting|audit|indemnity|insurance|hiscox|icaew|patent|trademark|consulting)\b/.test(
      lower
    )
  ) {
    return 'Professional Fees';
  }
  if (
    /\b(resin|filament|timber|steel|copper|fabric|packaging|pcb|prototype|components|materials|supplies)\b/.test(
      lower
    )
  ) {
    return 'Materials';
  }
  if (
    /\b(course|workshop|training|conference|summit|seminar|certification|udemy|coursera)\b/.test(
      lower
    )
  ) {
    return 'Training';
  }
  if (
    /\b(fortnum|hamper|champagne|gift|rolex|watches of switzerland)\b/.test(
      lower
    )
  ) {
    return 'Client Gifts';
  }
  if (
    /\b(ivy|hospitality|client dinner|bar|nightclub|entertaining)\b/.test(lower)
  ) {
    return 'Client Entertaining';
  }
  if (/\b(savile row|suit|tailor|wardrobe|clothing|shoes)\b/.test(lower)) {
    return 'Clothing';
  }
  if (
    /\b(dining|restaurant|cafe|coffee|pret|costa|lunch|dinner|meal|subsistence|refreshments)\b/.test(
      lower
    )
  ) {
    return 'Travel Meals';
  }

  switch (sourceType) {
    case 'bank_statement':
      return 'Office Costs';
    case 'invoice':
      return 'Professional Fees';
    case 'receipt':
      return 'Equipment';
  }
}

function parseItemisedLinesField(
  rawField: string,
  fallbackMerchant: string,
  grossAmount: number
): ParsedSpreadsheetItemisedLine[] | undefined {
  const trimmed = rawField.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed.replace(/""/g, '"'));
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((li: Record<string, unknown>, idx: number) => ({
          description: String(
            li.description || li.name || li.item || `Item #${idx + 1}`
          ),
          originalAmount: Math.max(
            1,
            Number(li.originalAmount ?? li.amount ?? li.price ?? 25)
          ),
          isBusiness: li.isBusiness !== undefined ? Boolean(li.isBusiness) : true,
          categoryTag: String(li.categoryTag || 'Receipt Line'),
        }));
      }
    } catch {
      // Fall through to delimiter parser
    }
  }

  // Semicolon or pipe separated e.g. "Prusa MK4S: 995; Hardened Nozzle: 95"
  if (trimmed.includes(';') || trimmed.includes('|')) {
    const segments = trimmed
      .split(/[;|]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (segments.length > 1) {
      const lines: ParsedSpreadsheetItemisedLine[] = [];
      for (const seg of segments) {
        const match = seg.match(/^(.*?)[:=-]\s*[$£€¥]?\s*([0-9.,]+)$/);
        if (match) {
          const desc = match[1].trim();
          const amt = parseNumericCell(match[2]);
          if (desc && amt !== null && amt > 0) {
            const isPersonal = /\b(personal|guest|wine|alcohol|private)\b/i.test(
              desc
            );
            lines.push({
              description: desc,
              originalAmount: Math.abs(amt),
              isBusiness: !isPersonal,
              categoryTag: isPersonal ? 'Personal / Guest' : 'Business Item',
            });
          }
        }
      }
      if (lines.length > 0) return lines;
    }
  }

  void fallbackMerchant;
  void grossAmount;
  return undefined;
}

function findHeaderKey(
  headers: string[],
  patterns: RegExp[]
): string | undefined {
  for (const pat of patterns) {
    const found = headers.find((h) => pat.test(h.trim()));
    if (found) return found;
  }
  return undefined;
}

/**
 * Converts a 2D array of spreadsheet cells (from XLSX or CSV) into structured
 * expense items for any of the 4 supported DataSourceTypes (`bank_statement`,
 * `receipt`, `invoice`, `car_journey`).
 */
export function convertSheetMatrixToExpenseRows(
  matrix: unknown[][],
  fileName: string,
  defaultSourceType: DataSourceType
): ParsedSpreadsheetExpenseRow[] {
  const nonEmptyRows = matrix.filter(
    (row) =>
      Array.isArray(row) &&
      row.some((cell) => String(cell ?? '').trim().length > 0)
  );
  if (nonEmptyRows.length === 0) return [];

  // Locate header row within the first 5 non-empty rows
  let headerRowIdx = 0;
  const headerKeywords =
    /\b(date|merchant|description|payee|supplier|vendor|route|journey|trip|miles|mileage|distance|amount|gross|total|debit|cost|price|category|invoice|currency)\b/i;

  for (let i = 0; i < Math.min(5, nonEmptyRows.length); i++) {
    const joined = nonEmptyRows[i].map((c) => String(c ?? '')).join(' ');
    if (headerKeywords.test(joined)) {
      headerRowIdx = i;
      break;
    }
  }

  const firstRowCells = nonEmptyRows[headerRowIdx].map((c) =>
    String(c ?? '').trim()
  );
  const hasHeader = firstRowCells.some((c) => headerKeywords.test(c));

  const headers = hasHeader
    ? firstRowCells.map((h, i) => h || `col_${i}`)
    : firstRowCells.map((_, i) => `col_${i}`);

  const dataRows = hasHeader
    ? nonEmptyRows.slice(headerRowIdx + 1)
    : nonEmptyRows;

  // Map column keys
  const dateKey = findHeaderKey(headers, [
    /^(transaction\s*)?date$/i,
    /^(invoice|trip|journey|receipt|value|posting)\s*date$/i,
    /\bdate\b/i,
    /^day$/i,
  ]);
  const merchantKey = findHeaderKey(headers, [
    /^(merchant|merchant_or_description|merchantordescription|payee|supplier|vendor|store|shop|counterparty)$/i,
    /^(description|narrative|details|memo|transaction\s*description|item\s*description|summary)$/i,
    /^(route|journey|trip|purpose|client)$/i,
    /\b(merchant|supplier|vendor|description|payee|route|journey)\b/i,
  ]);
  const secondaryDescKey = findHeaderKey(headers, [
    /^(item|line\s*item|service|details|notes|reference|memo|purpose)$/i,
  ]);
  const invoiceNumKey = findHeaderKey(headers, [
    /^(invoice\s*(no|number|id|#)|ref|reference|receipt\s*(no|id|#))$/i,
  ]);
  const fromLocationKey = findHeaderKey(headers, [
    /^(from|origin|start|start\s*location|departure)$/i,
  ]);
  const toLocationKey = findHeaderKey(headers, [
    /^(to|destination|end|end\s*location|arrival)$/i,
  ]);
  const categoryKey = findHeaderKey(headers, [
    /^(category|expense\s*type|type|nominal|sa103\s*box|account)$/i,
    /\bcategory\b/i,
  ]);
  const sourceTypeKey = findHeaderKey(headers, [
    /^(source|source_type|sourcetype|data\s*source)$/i,
  ]);
  const currencyKey = findHeaderKey(headers, [
    /^(currency|original_currency|originalcurrency|ccy|curr|iso)$/i,
    /\bcurrency\b/i,
  ]);
  const amountKey = findHeaderKey(headers, [
    /^(claimed_gross_amount|claimedgrossamount|gross_amount|grossamount|original_amount|originalamount)$/i,
    /^(amount|total|gross|total\s*amount|gross\s*total|cost|price|value|spend)$/i,
    /^(debit|money\s*out|paid\s*out|withdrawal| outflow)$/i,
    /\b(amount|total|gross|debit|price|cost)\b/i,
  ]);
  const creditKey = findHeaderKey(headers, [
    /^(credit|money\s*in|paid\s*in|deposit|inflow)$/i,
  ]);
  const milesKey = findHeaderKey(headers, [
    /^(miles|mileage|business\s*miles|distance\s*\(miles\)|mi)$/i,
    /\b(miles|mileage|distance|km|kilometres|kilometers)\b/i,
  ]);
  const splitPctKey = findHeaderKey(headers, [
    /^(business\s*%|work\s*%|split\s*%|business_percentage|businesspercentage|allowable\s*%)$/i,
  ]);
  const itemisedLinesKey = findHeaderKey(headers, [
    /^(line_items|lineitems|itemised_lines|itemisedlines|items|breakdown)$/i,
  ]);
  const lineItemDescKey = findHeaderKey(headers, [
    /^(line\s*item|line\s*description|item\s*name|dish|product)$/i,
  ]);
  const lineItemAmountKey = findHeaderKey(headers, [
    /^(line\s*amount|item\s*amount|item\s*price|unit\s*price|line\s*total)$/i,
  ]);
  const rawOcrKey = findHeaderKey(headers, [
    /^(raw_ocr_text|rawocrtext|raw_text|ocr_text|notes|memo)$/i,
  ]);

  const isKmColumn = milesKey ? /\b(km|kilometre|kilometer)\b/i.test(milesKey) : false;

  // Convert each row to a key-value map
  const rowObjects = dataRows.map((row) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      obj[h] = row[idx];
    });
    return { obj, rawCells: row };
  });

  // Group multi-row receipts/invoices if they share an Invoice/Receipt ID + Line Item columns
  if (
    (defaultSourceType === 'receipt' || defaultSourceType === 'invoice') &&
    lineItemDescKey &&
    lineItemAmountKey
  ) {
    const groupedMap = new Map<
      string,
      {
        firstObj: Record<string, unknown>;
        rawCells: unknown[];
        lines: ParsedSpreadsheetItemisedLine[];
      }
    >();

    for (const { obj, rawCells } of rowObjects) {
      const invId = invoiceNumKey ? String(obj[invoiceNumKey] ?? '').trim() : '';
      const merch = merchantKey ? String(obj[merchantKey] ?? '').trim() : '';
      const dt = dateKey ? formatNormalizedDate(obj[dateKey]) : '07 Nov';
      const groupKey = invId || `${dt}::${merch}`;
      if (!merch && !invId) continue;

      const lineDesc = String(obj[lineItemDescKey] ?? '').trim();
      const lineAmt = Math.abs(
        parseNumericCell(obj[lineItemAmountKey]) ??
          parseNumericCell(amountKey ? obj[amountKey] : 0) ??
          0
      );

      if (!groupedMap.has(groupKey)) {
        groupedMap.set(groupKey, { firstObj: obj, rawCells, lines: [] });
      }
      if (lineDesc && lineAmt > 0) {
        const isPersonal = /\b(personal|guest|private|wine|champagne)\b/i.test(
          lineDesc
        );
        groupedMap.get(groupKey)!.lines.push({
          description: lineDesc,
          originalAmount: lineAmt,
          isBusiness: !isPersonal,
          categoryTag: isPersonal ? 'Personal / Guest' : 'Business Item',
        });
      }
    }

    if (
      groupedMap.size > 0 &&
      Array.from(groupedMap.values()).some((g) => g.lines.length > 1)
    ) {
      const groupedResults: ParsedSpreadsheetExpenseRow[] = [];
      let idx = 0;
      for (const [, group] of groupedMap.entries()) {
        const sumLines = group.lines.reduce(
          (acc, l) => acc + l.originalAmount,
          0
        );
        const built = buildSingleExpenseRowFromCells(
          group.firstObj,
          group.rawCells,
          idx++,
          fileName,
          defaultSourceType,
          {
            dateKey,
            merchantKey,
            secondaryDescKey,
            invoiceNumKey,
            fromLocationKey,
            toLocationKey,
            categoryKey,
            sourceTypeKey,
            currencyKey,
            amountKey,
            creditKey,
            milesKey,
            isKmColumn,
            splitPctKey,
            itemisedLinesKey,
            rawOcrKey,
            hasHeader,
          },
          sumLines > 0 ? sumLines : undefined,
          group.lines.length > 0 ? group.lines : undefined
        );
        if (built) groupedResults.push(built);
      }
      if (groupedResults.length > 0) {
        return groupedResults.slice(0, 25);
      }
    }
  }

  const parsedRows: ParsedSpreadsheetExpenseRow[] = [];
  for (let i = 0; i < rowObjects.length; i++) {
    const { obj, rawCells } = rowObjects[i];
    const rowItem = buildSingleExpenseRowFromCells(
      obj,
      rawCells,
      i,
      fileName,
      defaultSourceType,
      {
        dateKey,
        merchantKey,
        secondaryDescKey,
        invoiceNumKey,
        fromLocationKey,
        toLocationKey,
        categoryKey,
        sourceTypeKey,
        currencyKey,
        amountKey,
        creditKey,
        milesKey,
        isKmColumn,
        splitPctKey,
        itemisedLinesKey,
        rawOcrKey,
        hasHeader,
      }
    );
    if (rowItem) {
      parsedRows.push(rowItem);
    }
  }

  return parsedRows.slice(0, 25);
}

interface ColumnMappingContext {
  dateKey?: string;
  merchantKey?: string;
  secondaryDescKey?: string;
  invoiceNumKey?: string;
  fromLocationKey?: string;
  toLocationKey?: string;
  categoryKey?: string;
  sourceTypeKey?: string;
  currencyKey?: string;
  amountKey?: string;
  creditKey?: string;
  milesKey?: string;
  isKmColumn: boolean;
  splitPctKey?: string;
  itemisedLinesKey?: string;
  rawOcrKey?: string;
  hasHeader: boolean;
}

function buildSingleExpenseRowFromCells(
  obj: Record<string, unknown>,
  rawCells: unknown[],
  rowIndex: number,
  fileName: string,
  defaultSourceType: DataSourceType,
  cols: ColumnMappingContext,
  overrideTotalAmount?: number,
  overrideItemisedLines?: ParsedSpreadsheetItemisedLine[]
): ParsedSpreadsheetExpenseRow | null {
  const rawLineString = rawCells
    .map((c) => String(c ?? '').trim())
    .filter(Boolean)
    .join(' | ');
  if (!rawLineString) return null;

  // Skip summary/footer rows such as "Total" or "Closing Balance" when merchant is empty
  if (
    /^(total|subtotal|grand\s*total|opening\s*balance|closing\s*balance|balance\s*brought\s*forward)$/i.test(
      String(rawCells[0] ?? '').trim()
    )
  ) {
    return null;
  }

  // If bank statement has a separate Credit / Money In column and Debit / Money Out is empty, skip income row
  if (cols.creditKey && cols.amountKey && cols.creditKey !== cols.amountKey) {
    const debitVal = parseNumericCell(obj[cols.amountKey]);
    const creditVal = parseNumericCell(obj[cols.creditKey]);
    if ((debitVal === null || debitVal === 0) && creditVal && creditVal > 0) {
      return null;
    }
  }

  // 1. Resolve Source Type
  const rawSourceStr = cols.sourceTypeKey
    ? String(obj[cols.sourceTypeKey] ?? '')
        .trim()
        .toLowerCase()
    : '';
  const sourceType: DataSourceType = (
    ['bank_statement', 'receipt', 'invoice', 'car_journey'] as const
  ).includes(rawSourceStr as DataSourceType)
    ? (rawSourceStr as DataSourceType)
    : defaultSourceType;

  // 2. Resolve Date
  const rawDateCell = cols.dateKey ? obj[cols.dateKey] : rawCells[0];
  const date = formatNormalizedDate(rawDateCell);

  // 3. Resolve Merchant / Description / Route
  let merchant = '';
  if (
    sourceType === 'car_journey' &&
    cols.fromLocationKey &&
    cols.toLocationKey &&
    (obj[cols.fromLocationKey] || obj[cols.toLocationKey])
  ) {
    const fromStr = String(obj[cols.fromLocationKey] ?? '').trim();
    const toStr = String(obj[cols.toLocationKey] ?? '').trim();
    const purposeStr = cols.merchantKey
      ? String(obj[cols.merchantKey] ?? '').trim()
      : cols.secondaryDescKey
        ? String(obj[cols.secondaryDescKey] ?? '').trim()
        : '';
    merchant = `${fromStr} → ${toStr}${purposeStr ? ` (${purposeStr})` : ''}`;
  } else if (cols.merchantKey && obj[cols.merchantKey] !== undefined) {
    merchant = String(obj[cols.merchantKey] ?? '').trim();
    if (
      cols.secondaryDescKey &&
      cols.secondaryDescKey !== cols.merchantKey &&
      obj[cols.secondaryDescKey]
    ) {
      const sec = String(obj[cols.secondaryDescKey] ?? '').trim();
      if (sec && !merchant.toLowerCase().includes(sec.toLowerCase())) {
        merchant = `${merchant} — ${sec}`;
      }
    }
    if (
      cols.invoiceNumKey &&
      cols.invoiceNumKey !== cols.merchantKey &&
      obj[cols.invoiceNumKey]
    ) {
      const invNo = String(obj[cols.invoiceNumKey] ?? '').trim();
      if (invNo && !merchant.includes(invNo)) {
        merchant = `${merchant} (${invNo})`;
      }
    }
  } else {
    merchant = String(
      rawCells[1] ?? rawCells[0] ?? `${fileName} — Row #${rowIndex + 1}`
    ).trim();
  }

  if (!merchant) return null;

  // 4. Resolve Miles (for car_journey or mileage rows)
  let miles: number | null = null;
  if (cols.milesKey && obj[cols.milesKey] !== undefined) {
    const rawDist = parseNumericCell(obj[cols.milesKey]);
    if (rawDist !== null && Math.abs(rawDist) > 0) {
      const absDist = Math.abs(rawDist);
      miles = cols.isKmColumn
        ? Math.max(1, Math.round(absDist * 0.621371))
        : Math.max(1, Math.round(absDist));
    }
  }
  if (miles === null && sourceType === 'car_journey') {
    // Look for "420 miles" or "420 mi" in description or numeric column
    const textMilesMatch = rawLineString.match(
      /\b(\d{1,5}(?:\.\d+)?)\s*(?:miles|mile|mi)\b/i
    );
    if (textMilesMatch) {
      miles = Math.max(1, Math.round(Number(textMilesMatch[1])));
    } else {
      // Check fallback numeric cell in row
      for (let cIdx = rawCells.length - 1; cIdx >= 1; cIdx--) {
        const candidate = parseNumericCell(rawCells[cIdx]);
        if (candidate !== null && Math.abs(candidate) > 0) {
          miles = Math.max(1, Math.round(Math.abs(candidate)));
          break;
        }
      }
    }
  }

  // 5. Resolve Amount & Currency
  let rawAmountCellStr = '';
  let numericAmount: number | null = overrideTotalAmount ?? null;

  if (numericAmount === null && cols.amountKey && obj[cols.amountKey] !== undefined) {
    rawAmountCellStr = String(obj[cols.amountKey] ?? '');
    const parsedAmt = parseNumericCell(obj[cols.amountKey]);
    if (parsedAmt !== null && Math.abs(parsedAmt) > 0) {
      numericAmount = Math.abs(parsedAmt);
    }
  }

  if (numericAmount === null && !cols.hasHeader) {
    // Legacy/headerless CSV fallback: check cols[4], cols[3], cols[2]
    const candidates = [rawCells[4], rawCells[3], rawCells[2], rawCells[rawCells.length - 1]];
    for (const cand of candidates) {
      const parsedAmt = parseNumericCell(cand);
      if (parsedAmt !== null && Math.abs(parsedAmt) > 0) {
        rawAmountCellStr = String(cand ?? '');
        numericAmount = Math.abs(parsedAmt);
        break;
      }
    }
  }

  if (numericAmount === null && sourceType === 'car_journey' && miles) {
    numericAmount = calculateHMRCMileageGross(miles);
  }

  if (numericAmount === null || numericAmount <= 0) {
    // Check any numeric cell from right to left
    for (let cIdx = rawCells.length - 1; cIdx >= 1; cIdx--) {
      const parsedAmt = parseNumericCell(rawCells[cIdx]);
      if (parsedAmt !== null && Math.abs(parsedAmt) > 0) {
        rawAmountCellStr = String(rawCells[cIdx] ?? '');
        numericAmount = Math.abs(parsedAmt);
        break;
      }
    }
  }

  if (numericAmount === null || numericAmount <= 0) {
    return null;
  }

  const rawCurrencyVal = cols.currencyKey
    ? String(obj[cols.currencyKey] ?? '').trim()
    : '';
  const detectedCurrency =
    sourceType === 'car_journey'
      ? 'GBP'
      : detectCurrencyFromTextAndMerchant(
          rawCurrencyVal,
          merchant,
          `${rawAmountCellStr} ${rawLineString}`
        );

  const grossAmount =
    sourceType === 'car_journey' && miles
      ? calculateHMRCMileageGross(miles)
      : Math.round(numericAmount * 100) / 100;

  // 6. Resolve Category
  const rawCatStr = cols.categoryKey ? String(obj[cols.categoryKey] ?? '') : '';
  const category = inferCategoryFromMerchantAndSource(
    merchant,
    rawCatStr,
    sourceType
  );

  // 7. Resolve Itemised Lines
  const itemisedLines =
    overrideItemisedLines ??
    (cols.itemisedLinesKey && obj[cols.itemisedLinesKey]
      ? parseItemisedLinesField(
          String(obj[cols.itemisedLinesKey] ?? ''),
          merchant,
          grossAmount
        )
      : undefined);

  // 8. Resolve Business Split %
  const explicitSplit = cols.splitPctKey
    ? parseNumericCell(obj[cols.splitPctKey])
    : null;
  const splitOptionPercentage =
    explicitSplit !== null && explicitSplit > 0 && explicitSplit < 100
      ? Math.round(explicitSplit)
      : category === 'Phone & Data' || category === 'Travel Meals'
        ? 50
        : 80;

  const rawOcrSnippet =
    cols.rawOcrKey && obj[cols.rawOcrKey]
      ? String(obj[cols.rawOcrKey])
      : `SPREADSHEET_ROW (${fileName}): ${rawLineString}`;

  const isDisallowed =
    category === 'Client Entertaining' ||
    category === 'Client Gifts' ||
    category === 'Clothing';

  return {
    date,
    merchantOrDescription: merchant,
    category,
    sourceType,
    originalCurrency: detectedCurrency,
    originalAmount: grossAmount,
    grossAmount: Math.round(grossAmount),
    miles,
    aiSuggestedPercentage: isDisallowed ? 0 : explicitSplit ?? 100,
    confidencePercent: 95,
    highAuditRisk: !isDisallowed,
    rawLineSnippet: rawOcrSnippet,
    needsClarification: !isDisallowed,
    isDisallowed,
    disallowedReason: isDisallowed
      ? `Disallowed under UK Self Assessment rules (${category}).`
      : null,
    aiContextNote: `Extracted from ${fileName} (${sourceType.replace('_', ' ')})`,
    aiQuestion:
      sourceType === 'car_journey' && miles
        ? `Was this ${miles.toLocaleString()}-mile journey ("${merchant}") strictly for business travel or mixed with personal driving?`
        : `Was "${merchant}" used 100% for work, split, or personal?`,
    splitOptionPercentage,
    taxRuleReference:
      sourceType === 'car_journey'
        ? 'HMRC Simplified Mileage (ITTOIA 2005 s.94D — 45p/mi)'
        : category === 'Equipment'
          ? 'CAA 2001 s.51A (100% AIA) / ITTOIA 2005 s.34'
          : 'ITTOIA 2005 s.34 (Wholly & Exclusively)',
    whatWouldChangeMind:
      'Confirm business use percentage and retain invoice/statement under TMA 1970 s.12B.',
    itemisedLines,
  };
}

/**
 * Parses an Excel (.xlsx / .xls) ArrayBuffer across all worksheets and returns
 * structured expense rows plus a normalized CSV representation.
 */
export function parseExcelArrayBufferToRows(
  buffer: ArrayBuffer | Uint8Array,
  fileName: string,
  defaultSourceType: DataSourceType
): SpreadsheetParseOutput {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetNames = workbook.SheetNames || [];
  const allItems: ParsedSpreadsheetExpenseRow[] = [];
  const csvSections: string[] = [];
  let totalRowsRead = 0;

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });
    if (!matrix || matrix.length === 0) continue;

    totalRowsRead += matrix.length;
    const csvText = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csvText.trim()) {
      csvSections.push(`--- SHEET: ${sheetName} ---\n${csvText.trim()}`);
    }

    const sheetItems = convertSheetMatrixToExpenseRows(
      matrix,
      fileName,
      defaultSourceType
    );
    allItems.push(...sheetItems);
  }

  return {
    items: allItems.slice(0, 25),
    normalizedCsvText: csvSections.join('\n\n'),
    sheetNames,
    totalRowsRead,
  };
}

/**
 * Parses a CSV / TSV string into structured expense rows using SheetJS +
 * header-aware column mapping for all 4 supported expense types.
 */
export function parseCsvTextToRows(
  csvText: string,
  fileName: string,
  defaultSourceType: DataSourceType
): SpreadsheetParseOutput {
  const trimmed = csvText.trim();
  if (!trimmed) {
    return {
      items: [],
      normalizedCsvText: '',
      sheetNames: ['CSV'],
      totalRowsRead: 0,
    };
  }

  try {
    const workbook = XLSX.read(trimmed, {
      type: 'string',
      raw: false,
      cellDates: true,
    });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined;
    if (sheet) {
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: '',
        blankrows: false,
      });
      if (matrix && matrix.length > 0) {
        const items = convertSheetMatrixToExpenseRows(
          matrix,
          fileName,
          defaultSourceType
        );
        return {
          items,
          normalizedCsvText: trimmed,
          sheetNames: [firstSheetName],
          totalRowsRead: matrix.length,
        };
      }
    }
  } catch {
    // Fallback to simple line-by-line matrix split if XLSX string parse fails
  }

  const fallbackMatrix = trimmed
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const cells: string[] = [];
      let curr = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          cells.push(curr.trim());
          curr = '';
        } else {
          curr += ch;
        }
      }
      cells.push(curr.trim());
      return cells;
    });

  const items = convertSheetMatrixToExpenseRows(
    fallbackMatrix,
    fileName,
    defaultSourceType
  );
  return {
    items,
    normalizedCsvText: trimmed,
    sheetNames: ['CSV'],
    totalRowsRead: fallbackMatrix.length,
  };
}

/**
 * Generates a realistic, multi-row sample spreadsheet (.xlsx or .csv) for any
 * of the 4 supported expense types (`bank_statement`, `receipt`, `invoice`, `car_journey`)
 * so users or judges can download and test uploading `.xlsx` and `.csv` files immediately.
 */
export function generateSampleSpreadsheetBuffer(
  sourceType: DataSourceType,
  format: 'xlsx' | 'csv'
): { data: Uint8Array | string; fileName: string; mimeType: string } {
  let rows: Array<Record<string, string | number>> = [];
  let baseFileName = '';

  switch (sourceType) {
    case 'bank_statement':
      baseFileName = 'uk_business_bank_statement_2025';
      rows = [
        {
          Date: '2025-11-02',
          Merchant: 'Apple Store Regent St — MacBook Pro M4 Studio',
          Category: 'Equipment',
          Currency: 'GBP',
          'Money Out': 1850,
          Notes: 'Studio CAD & 3D rendering workstation',
        },
        {
          Date: '2025-11-04',
          Merchant: 'Vodafone UK — Unlimited 5G Plan & Roaming',
          Category: 'Phone & Data',
          Currency: 'GBP',
          'Money Out': 640,
          Notes: 'Shared work and personal mobile contract',
        },
        {
          Date: '2025-11-05',
          Merchant: 'Figma Inc (San Francisco)',
          Category: 'Software',
          Currency: 'USD',
          'Money Out': 580,
          Notes: 'Annual UI/CAD collaborative design seat (USD $580)',
        },
      ];
      break;

    case 'receipt':
      baseFileName = 'itemised_receipts_and_tickets_2025';
      rows = [
        {
          Date: '2025-11-03',
          'Receipt No': 'RCP-HK-3425',
          Merchant: 'Mercury Recalls — Group Dining & Refreshments (Causeway Bay, Hong Kong)',
          Category: 'Travel Meals',
          Currency: 'HKD',
          'Total Amount': 1613,
          'Itemised Lines':
            'Working Subsistence Set Meal (HK$): 813; Refreshments & 10% Service Charge (HK$): 653',
        },
        {
          Date: '2025-11-06',
          'Receipt No': 'RCP-LON-419',
          Merchant: 'Wex Photo Video London — Sony Lens & SD Cards',
          Category: 'Equipment',
          Currency: 'GBP',
          'Total Amount': 890,
          'Itemised Lines':
            'Sony FE 50mm Macro Lens for Prototype Photography: 740; SanDisk Extreme Pro SD Cards: 150',
        },
      ];
      break;

    case 'invoice':
      baseFileName = 'supplier_invoices_schedule_2025';
      rows = [
        {
          'Invoice Date': '2025-10-28',
          'Invoice No': 'INV-2025-904',
          Supplier: 'PCBWay Prototyping Ltd (Shenzhen / HK)',
          Description: 'CNC Aluminium Enclosures & 5x Prototype PCBs',
          Category: 'Materials',
          Currency: 'USD',
          'Gross Amount': 1420,
        },
        {
          'Invoice Date': '2025-11-01',
          'Invoice No': 'INV-2025-918',
          Supplier: 'Hiscox Business Insurance UK',
          Description: 'Professional Indemnity & Product Liability Cover',
          Category: 'Professional Fees',
          Currency: 'GBP',
          'Gross Amount': 540,
        },
      ];
      break;

    case 'car_journey':
      baseFileName = 'gps_business_mileage_log_2025';
      rows = [
        {
          Date: '2025-10-19',
          From: 'Shoreditch Design Studio (E2)',
          To: 'Birmingham NEC Manufacturing Expo',
          Purpose: 'Exhibitor prototype delivery & supplier sourcing',
          Miles: 240,
          Vehicle: 'Kia Niro EV (Own Car)',
        },
        {
          Date: '2025-10-27',
          From: 'Shoreditch Design Studio (E2)',
          To: 'Sheffield Precision Moulding Ltd',
          Purpose: 'Injection mould tooling inspection round-trip',
          Miles: 330,
          Vehicle: 'Kia Niro EV (Own Car)',
        },
        {
          Date: '2025-11-04',
          From: 'Shoreditch Design Studio (E2)',
          To: 'Reading Assembly Partner',
          Purpose: 'Batch QA sign-off visit',
          Miles: 95,
          Vehicle: 'Kia Niro EV (Own Car)',
        },
      ];
      break;
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses_2025_26');

  if (format === 'csv') {
    const csvStr = XLSX.utils.sheet_to_csv(worksheet);
    return {
      data: csvStr,
      fileName: `${baseFileName}.csv`,
      mimeType: 'text/csv;charset=utf-8;',
    };
  }

  const xlsxBuffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
  }) as Uint8Array;
  return {
    data: xlsxBuffer,
    fileName: `${baseFileName}.xlsx`,
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}
