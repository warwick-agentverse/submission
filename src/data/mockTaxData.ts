import {
  AuditLogEntry,
  ExpenseItem,
  IngestionBatchPreset,
  TaxReliefSubsidy,
  calculateHMRCMileageGross,
} from '../utils/taxEngine';

export const INITIAL_GROSS_INCOME = 78500;

export const INITIAL_EXPENSES: ExpenseItem[] = [
  {
    id: 'exp-201',
    date: '05 Oct',
    merchantOrDescription: 'Adobe, Figma & AWS Cloud (Email Receipts)',
    source: 'bank_statement',
    mediaFormat: 'email_forward',
    sourceDocumentName: 'saas_billing_emails.eml',
    category: 'Software',
    grossAmount: 1480,
    businessPercentage: 100,
    aiSuggestedPercentage: 100,
    confidencePercent: 99,
    rawLineSnippet:
      'EMAIL_PARSE: billing@figma.com + aws-receivables@amazon.com | TOTAL SaaS: -1480.00 GBP',
    status: 'verified',
    caReviewStatus: 'ca_approved',
    selectedOptionLabel: '100% Work',
    taxRuleReference: 'Deductible SaaS (ITTOIA s.34)',
    whatWouldChangeMind:
      'Reduce below 100% only if software seats are shared with non-business household members.',
  },
  {
    id: 'exp-202',
    date: '22 Sep',
    merchantOrDescription: 'Hiscox Indemnity Insurance',
    source: 'receipt',
    mediaFormat: 'proprietary_invoice',
    sourceDocumentName: 'hiscox_policy_schedule.pdf',
    category: 'Insurance',
    grossAmount: 640,
    businessPercentage: 100,
    aiSuggestedPercentage: 100,
    confidencePercent: 99,
    rawLineSnippet:
      'PROPRIETARY_PDF: HISCOX POLICY #PL-90812 | PROF INDEMNITY | £640.00',
    status: 'verified',
    caReviewStatus: 'ca_approved',
    selectedOptionLabel: '100% Work',
    taxRuleReference: 'Deductible Cover (HS222)',
    whatWouldChangeMind:
      '100% statutory trade deduction under ITTOIA 2005 s.34 unless policy covers personal home contents.',
  },
  {
    id: 'exp-203',
    date: '01 Sep',
    merchantOrDescription: 'WeWork Desk & Meeting Rooms',
    source: 'invoice',
    mediaFormat: 'proprietary_invoice',
    sourceDocumentName: 'wework_proprietary_inv.pdf',
    category: 'Workspace',
    grossAmount: 1890,
    businessPercentage: 100,
    aiSuggestedPercentage: 100,
    confidencePercent: 98,
    rawLineSnippet:
      'PROPRIETARY_INVOICE: WEWORK UK #WW-4421 | ALL ACCESS + ROOMS | £1,890.00',
    status: 'verified',
    caReviewStatus: 'ca_approved',
    selectedOptionLabel: '100% Work',
    taxRuleReference: 'Deductible Office (SA103 Box 21)',
    whatWouldChangeMind:
      'Disallow only if invoice includes non-business social event room hire.',
  },
  {
    id: 'exp-204',
    date: '19 Aug',
    merchantOrDescription: '1,620 Verified Client Miles (Residence Excluded)',
    source: 'car_journey',
    mediaFormat: 'gps_log',
    sourceDocumentName: 'mileage_q3_gps.csv',
    category: 'Mileage',
    grossAmount: calculateHMRCMileageGross(1620), // Dynamically computed: 1620 * 0.45 = £729
    miles: 1620,
    businessPercentage: 100,
    aiSuggestedPercentage: 100,
    confidencePercent: 96,
    rawLineSnippet:
      'GPS_AGGREGATE: 1,620.0 VERIFIED BUSINESS MILES (EXCLUDING RESIDENCE COMMUTE) @ £0.45/MI = £729.00',
    status: 'verified',
    caReviewStatus: 'ca_approved',
    selectedOptionLabel: '45p/mile rate',
    taxRuleReference: '45p/mi Allowance (ITTOIA s.94D)',
    whatWouldChangeMind:
      'Switch rate from 45p/mi to 25p/mi if cumulative annual business mileage exceeds 10,000 miles (ITTOIA 2005 s.94D).',
  },
  {
    id: 'exp-205',
    date: '04 Aug',
    merchantOrDescription: 'Studio Kinetix Proprietary CAD Invoice',
    source: 'invoice',
    mediaFormat: 'proprietary_invoice',
    sourceDocumentName: 'studio_kinetix_inv_409.pdf',
    category: 'Subcontractors',
    grossAmount: 2450,
    businessPercentage: 100,
    aiSuggestedPercentage: 100,
    confidencePercent: 99,
    rawLineSnippet:
      'PROPRIETARY_INVOICE: STUDIO KINETIX #409 | 3D CAD RENDERING | £2,450.00',
    status: 'verified',
    caReviewStatus: 'ca_approved',
    selectedOptionLabel: '100% Work',
    taxRuleReference: 'Deductible Subcontractor (SA103 Box 17)',
    whatWouldChangeMind:
      'Reclassify to Capital Allowances (SA103 Box 49) if subcontractor built permanent studio machinery rather than client project deliverables.',
  },
  {
    id: 'exp-206',
    date: '01 Aug',
    merchantOrDescription: 'Fortnum & Mason Client Luxury Hamper Gift',
    source: 'receipt',
    mediaFormat: 'receipt_photo',
    sourceDocumentName: 'fortnum_receipt_photo.jpg',
    category: 'Client Gifts',
    grossAmount: 340,
    businessPercentage: 0,
    aiSuggestedPercentage: 100, // AI saw "Client Gift" and suggested 100%, Coded Block List forced to £0!
    confidencePercent: 99,
    rawLineSnippet:
      'OCR_PHOTO: FORTNUM & MASON PICCADILLY | LUXURY HAMPER | £340.00',
    status: 'blocked_by_guardrail',
    caReviewStatus: 'ca_approved',
    selectedOptionLabel: 'Blocked (>£50 Gift Limit)',
    taxRuleReference: 'Blocked: ITTOIA s.47 (>£50/yr)',
    guardrailBlockReason:
      'Hard-blocked by Coded Block List: Client gifts over £50/yr or containing food/alcohol are strictly disallowed (ITTOIA 2005 s.47). Forced to £0.',
    whatWouldChangeMind:
      'Approve up to £50/yr only if receipt shows a branded promotional item (non-food, non-alcohol, non-voucher) costing ≤ £50 per client per tax year (ITTOIA 2005 s.47).',
  },
];

export const INITIAL_TAX_RELIEFS: TaxReliefSubsidy[] = [
  {
    id: 'relief-home-office',
    title: 'Proportional Home Office Bills',
    authorityCode: 'HMRC BIM47820',
    hmrcUrl:
      'https://www.gov.uk/hmrc-internal-manuals/business-income-manual/bim47820',
    category: 'Simplified Expense',
    annualDeductionAmount: 1680,
    estimatedTaxSaving: 706,
    rawInputs: {
      rawBaseSpendGbp: 4800,
      statutoryMultiplier: 0.35,
      formulaExplanation:
        '£4,800/yr utility & council tax bills × 35% (1 studio room of 3 rooms weighted by 85% work hours) = £1,680',
    },
    whyOftenMissed:
      'Claims your real room share of energy & council tax instead of the £6/wk flat rate.',
    aiDetectionEvidence:
      'Calculated from £4,800/yr utility bills on your bank statement.',
    whatWouldChangeMind:
      'Fallback to £312/yr (£6/wk simplified flat rate) if studio room is used <25 hours/month or utility bills are under £900/yr.',
    eligibilityQuestion: 'Claim proportional home bills',
    claimed: true,
    recommended: true,
  },
  {
    id: 'relief-pre-trading',
    title: 'Pre-Registration Startup Gear',
    authorityCode: 'HMRC BIM46351',
    hmrcUrl:
      'https://www.gov.uk/hmrc-internal-manuals/business-income-manual/bim46351',
    category: 'Allowance',
    annualDeductionAmount: 1450,
    estimatedTaxSaving: 609,
    rawInputs: {
      rawBaseSpendGbp: 1450,
      statutoryMultiplier: 1.0,
      formulaExplanation:
        '£890 Sony reference lens + £560 Herman Miller studio chair (incurred within 7 years pre-registration) × 100% = £1,450',
    },
    whyOftenMissed:
      'Equipment bought up to 7 years before registering as a sole trader is deductible.',
    aiDetectionEvidence:
      'Matched camera lens (£890) & desk chair (£560) bought before registration.',
    whatWouldChangeMind:
      'Requires original purchase receipts dated within 7 years prior to trade start date under ITTOIA 2005 s.57.',
    eligibilityQuestion: 'Claim pre-registration gear',
    claimed: false,
    recommended: true,
  },
  {
    id: 'relief-sipp-uplift',
    title: 'Higher-Rate Pension Rebate',
    authorityCode: 'GOV.UK Pension Relief',
    hmrcUrl: 'https://www.gov.uk/tax-on-your-private-pension/pension-tax-relief',
    category: 'Subsidy & Credit',
    annualDeductionAmount: 3600,
    estimatedTaxSaving: 1512,
    rawInputs: {
      rawBaseSpendGbp: 2880,
      statutoryMultiplier: 1.25,
      formulaExplanation:
        '£2,880 net Vanguard SIPP contributions (12 × £240/mo) × 1.25 Basic-Rate Gross-Up = £3,600 gross band extension',
    },
    whyOftenMissed:
      'Unlocks the extra 20% tax refund on personal pension payments above £50,270 income.',
    aiDetectionEvidence:
      'Found £240/mo net (£300 gross) Vanguard pension transfers on your statement.',
    whatWouldChangeMind:
      'Higher-rate rebate applies only while taxable profit exceeds £50,270; if income drops below £50,270, only basic 20% relief at source applies.',
    eligibilityQuestion: 'Claim 20% pension rebate',
    claimed: false,
    recommended: true,
  },
  {
    id: 'relief-aia-pool',
    title: '100% Year-1 Equipment Write-Off (AIA)',
    authorityCode: 'GOV.UK AIA Guide',
    hmrcUrl:
      'https://www.gov.uk/capital-allowances/annual-investment-allowance',
    category: 'Capital Relief',
    annualDeductionAmount: 1920,
    estimatedTaxSaving: 806,
    rawInputs: {
      rawBaseSpendGbp: 1920,
      statutoryMultiplier: 1.0,
      formulaExplanation:
        '£1,920 Apple Studio Display & calibration hardware × 100% Year-1 AIA (CAA 2001 s.51A) = £1,920 (vs £346 @ 18% WDA)',
    },
    whyOftenMissed:
      'Deducts 100% of studio hardware immediately instead of 18% per year.',
    aiDetectionEvidence:
      'Applied to £1,920 studio display & calibration hardware.',
    whatWouldChangeMind:
      'Must be plant & machinery (excluding cars); if asset is sold later, a balancing charge applies under CAA 2001.',
    eligibilityQuestion: 'Deduct 100% in Year 1',
    claimed: true,
    recommended: true,
  },
  {
    id: 'relief-eyecare-cpd',
    title: 'Screen Glasses & Trade Subscriptions',
    authorityCode: 'HMRC BIM47105',
    hmrcUrl:
      'https://www.gov.uk/hmrc-internal-manuals/business-income-manual/bim47105',
    category: 'Allowance',
    annualDeductionAmount: 580,
    estimatedTaxSaving: 244,
    rawInputs: {
      rawBaseSpendGbp: 580,
      statutoryMultiplier: 1.0,
      formulaExplanation:
        '£195 VDU screen prescription glasses + £385 Chartered Society of Designers subscription × 100% = £580',
    },
    whyOftenMissed:
      'Screen eyewear and professional body memberships are 100% deductible.',
    aiDetectionEvidence:
      'Found £195 optician receipt + £385 trade subscriptions.',
    whatWouldChangeMind:
      'Approve VDU glasses only if optician certificate confirms prescription is specifically required for monitor work.',
    eligibilityQuestion: 'Claim eyewear & memberships',
    claimed: false,
    recommended: false,
  },
  {
    id: 'relief-trivial-spouse',
    title: 'Partner Admin & Bookkeeping Support',
    authorityCode: 'HMRC BIM37735',
    hmrcUrl:
      'https://www.gov.uk/hmrc-internal-manuals/business-income-manual/bim37735',
    category: 'Allowance',
    annualDeductionAmount: 2400,
    estimatedTaxSaving: 1008,
    rawInputs: {
      rawBaseSpendGbp: 2400,
      statutoryMultiplier: 1.0,
      formulaExplanation:
        '12 months × £200/mo commercial admin & reconciliation work (10 hrs/mo @ £20/hr market rate) = £2,400',
    },
    whyOftenMissed:
      'Commercial payments to a partner for invoicing & admin help are deductible.',
    aiDetectionEvidence: 'Matched recurring £200/mo "Admin Help" transfers.',
    whatWouldChangeMind:
      'Requires contemporary timesheet + actual bank transfer records proving wages were paid at commercial market rate (BIM37735).',
    eligibilityQuestion: 'Claim partner admin wages',
    claimed: false,
    recommended: false,
    requiresDocumentation: true,
  },
];

export const INGESTION_BATCH_PRESETS: IngestionBatchPreset[] = [
  {
    id: 'batch-bank-q4',
    source: 'bank_statement',
    title: 'Bank Statements & Email Bills',
    subtitle: '342 transactions · EE mobile email, AI course & Stripe fees',
    fileName: 'barclays_q4_and_emails.csv',
    itemCount: 3,
    potentialTaxSaving: 1068,
    ingested: false,
    itemsToUnlock: [
      {
        id: 'exp-104',
        date: '15 Sep',
        merchantOrDescription: 'EE Mobile Plan (12 × £68/mo Email Invoice)',
        source: 'bank_statement',
        mediaFormat: 'email_forward',
        sourceDocumentName: 'ee_monthly_statement_fwd.eml',
        category: 'Phone & Data',
        grossAmount: 816,
        businessPercentage: 80,
        aiSuggestedPercentage: 100,
        highAuditRisk: true,
        confidencePercent: 89,
        rawLineSnippet:
          'EMAIL_FORWARD: From billing@ee.co.uk | 12x DD "EE LIMITED CONTRACT" @ -68.00/mo = -816.00/yr',
        status: 'needs_clarification',
        aiContextNote: 'Forwarded email invoice · Personal contract work share',
        aiQuestion: 'What share of your mobile plan is used for business calls & data?',
        whatWouldChangeMind:
          'Approve 100% deduction (£816) if mobile contract is in sole trader trade name or itemised call log proves ≥95% business calls/data (HMRC BIM47820).',
        clarificationOptions: [
          {
            id: 'ee-80',
            label: '80% Work',
            businessPercentage: 80,
            taxRuleApplied: '80% Telecoms Split (BIM47820)',
          },
          {
            id: 'ee-50',
            label: '50% Split',
            businessPercentage: 50,
            taxRuleApplied: '50% Telecoms Split',
          },
          {
            id: 'ee-0',
            label: 'Personal',
            businessPercentage: 0,
            taxRuleApplied: 'Not Claimed',
          },
        ],
        taxRuleReference: 'Needs answer',
      },
      {
        id: 'exp-302',
        date: '28 Oct',
        merchantOrDescription: 'AI Consulting Skills Course (Email Receipt)',
        source: 'bank_statement',
        mediaFormat: 'email_forward',
        sourceDocumentName: 'maven_course_email.eml',
        category: 'Training',
        grossAmount: 950,
        businessPercentage: 100,
        aiSuggestedPercentage: 100,
        confidencePercent: 91,
        rawLineSnippet:
          'EMAIL_FORWARD: receipt@maven.com | "MAVEN AI CONSULTING COHORT" | £950.00',
        status: 'needs_clarification',
        aiContextNote:
          'Refresher training for existing trade is 100% deductible (BIM35660)',
        aiQuestion: 'Was this £950 course to update your existing business skills?',
        whatWouldChangeMind:
          'Approve 100% under HMRC BIM35660 if course updates existing industrial design skills; disallow if training for an entirely unrelated new profession.',
        clarificationOptions: [
          {
            id: 'course-100',
            label: '100% Work',
            businessPercentage: 100,
            taxRuleApplied: 'Deductible Training (BIM35660)',
          },
          {
            id: 'course-50',
            label: '50% Split',
            businessPercentage: 50,
            taxRuleApplied: '50% Training Split',
          },
          {
            id: 'course-0',
            label: 'Personal',
            businessPercentage: 0,
            taxRuleApplied: 'Excluded Personal',
          },
        ],
        taxRuleReference: 'Needs answer',
      },
      {
        id: 'exp-301',
        date: '02 Nov',
        merchantOrDescription: 'Stripe & Bank Account Fees (Screenshot)',
        source: 'bank_statement',
        mediaFormat: 'screenshot',
        sourceDocumentName: 'stripe_dashboard_screenshot.png',
        category: 'Bank Fees',
        grossAmount: 940,
        businessPercentage: 100,
        aiSuggestedPercentage: 100,
        confidencePercent: 99,
        rawLineSnippet:
          'SCREENSHOT_OCR: 2026-11-02,FEE,"STRIPE UK PROCESSING FEES",-940.00,GBP',
        status: 'needs_clarification',
        aiContextNote: 'Merchant payment processing & business bank charges',
        aiQuestion: 'Were these Stripe & bank fees 100% for business, split, or personal?',
        whatWouldChangeMind:
          '100% deductible under SA103 Box 27 as direct merchant processing charges.',
        clarificationOptions: [
          {
            id: 'stripe-100',
            label: '100% Work',
            businessPercentage: 100,
            taxRuleApplied: 'Deductible Fees (SA103 Box 27)',
          },
          {
            id: 'stripe-50',
            label: '50% Split',
            businessPercentage: 50,
            taxRuleApplied: '50% Mixed Account Fees',
          },
          {
            id: 'stripe-0',
            label: 'Personal',
            businessPercentage: 0,
            taxRuleApplied: 'Excluded Personal',
          },
        ],
        taxRuleReference: 'Needs answer',
      },
    ],
  },
  {
    id: 'batch-receipts-camera',
    source: 'receipt',
    title: 'Receipt Photos & App Screenshots',
    subtitle: 'MacBook Pro photo, Hoxton itemised restaurant bill & Sony gear',
    fileName: 'receipts_photos_oct.zip',
    itemCount: 4,
    potentialTaxSaving: 1798,
    ingested: false,
    itemsToUnlock: [
      {
        id: 'exp-101',
        date: '18 Oct',
        merchantOrDescription: 'Apple Store — MacBook Pro 16"',
        source: 'receipt',
        mediaFormat: 'receipt_photo',
        sourceDocumentName: 'apple_receipt_photo.jpg',
        category: 'Equipment',
        grossAmount: 3299,
        businessPercentage: 100,
        aiSuggestedPercentage: 100,
        highAuditRisk: true,
        confidencePercent: 94,
        rawLineSnippet:
          'OCR_PHOTO: APPLE REGENT ST #UK-88412 | MBP 16 M4 MAX | £3,299.00 | VAT £549.83',
        status: 'needs_clarification',
        aiContextNote: 'Camera photo of Receipt #UK-88412 · Decision Tree Node 2',
        aiQuestion: 'Is this MacBook Pro used 100% for your business or shared personally?',
        whatWouldChangeMind:
          'Approve full 100% AIA write-off (£3,299 → +£1,386 tax saved) if user packs a VAT invoice in business name + asset usage log showing ≥95% commercial studio use.',
        clarificationOptions: [
          {
            id: 'mac-100',
            label: '100% Work',
            businessPercentage: 100,
            taxRuleApplied: '100% AIA Equipment Relief (CAA 2001)',
          },
          {
            id: 'mac-85',
            label: '85% Split',
            businessPercentage: 85,
            taxRuleApplied: '85% Apportioned Asset (HS222)',
          },
          {
            id: 'mac-0',
            label: 'Personal',
            businessPercentage: 0,
            taxRuleApplied: 'Excluded Personal',
          },
        ],
        taxRuleReference: 'Needs answer',
      },
      {
        id: 'exp-103',
        date: '29 Sep',
        merchantOrDescription: 'The Hoxton Grill (Itemised Restaurant Bill)',
        source: 'receipt',
        mediaFormat: 'screenshot',
        sourceDocumentName: 'hoxton_itemised_screenshot.png',
        category: 'Travel Meals',
        grossAmount: 185,
        restaurantMetadata: {
          lines: [
            {
              item: '1x Overnight Subsistence Main & Water (Sole Trader)',
              amountGbp: 92.5,
              isClientPurpose: false,
              allowable: true,
              ruleNote: 'Allowable overnight travel subsistence (HMRC BIM47705)',
            },
            {
              item: '1x Guest Ribeye Steak & Malbec (Client Hospitality)',
              amountGbp: 92.5,
              isClientPurpose: true,
              allowable: false,
              ruleNote: 'Disallowed client entertaining (ITTOIA 2005 s.45)',
            },
          ],
        },
        businessPercentage: 50,
        aiSuggestedPercentage: 100,
        highAuditRisk: true,
        confidencePercent: 82,
        rawLineSnippet:
          'ITEMISED_BILL_SCREENSHOT: THE HOXTON GRILL | LINE 1: OWN TRAVEL DINNER £92.50 | LINE 2: CLIENT GUEST STEAK & WINE £92.50 | TOTAL: £185.00',
        status: 'needs_clarification',
        aiContextNote:
          'Itemised bill: £92.50 own travel meal + £92.50 guest meal · Client items disallowed',
        aiQuestion:
          'Were any itemised restaurant bill lines for a client, or 100% overnight travel subsistence?',
        whatWouldChangeMind:
          'Approve 50% (£93) if itemised bill separates own overnight travel meal from client guest meal; approve 100% (£185) if no client attended; hard-block to £0 if entire bill was client entertaining (ITTOIA 2005 s.45).',
        clarificationOptions: [
          {
            id: 'hoxton-subsistence',
            label: '100% Work',
            businessPercentage: 100,
            taxRuleApplied: 'Overnight Subsistence (BIM47705)',
          },
          {
            id: 'hoxton-split',
            label: '50% Split',
            businessPercentage: 50,
            taxRuleApplied: '50% Subsistence (Client Line Excluded)',
          },
          {
            id: 'hoxton-entertainment',
            label: 'Personal',
            businessPercentage: 0,
            triggersGuardrailBlock: true,
            guardrailReason:
              'Hard-blocked by Coded Block List: ITTOIA 2005 s.45 (Client Entertainment Disallowance)',
            taxRuleApplied: 'Blocked: Client Entertaining',
          },
        ],
        taxRuleReference: 'Needs answer',
      },
      {
        id: 'exp-304',
        date: '19 Oct',
        merchantOrDescription: 'Sony Headphones & Studio Mic (Receipt Photo)',
        source: 'receipt',
        mediaFormat: 'receipt_photo',
        sourceDocumentName: 'john_lewis_photo.jpg',
        category: 'Equipment',
        grossAmount: 640,
        businessPercentage: 100,
        aiSuggestedPercentage: 100,
        highAuditRisk: true,
        confidencePercent: 88,
        rawLineSnippet:
          'CAMERA_PHOTO: JOHN LEWIS #991 | SONY WH1000XM5 + SHURE MIC | £640.00',
        status: 'needs_clarification',
        aiContextNote: 'John Lewis VAT receipt photo (£640)',
        aiQuestion: 'Do you use this audio gear for client calls?',
        whatWouldChangeMind:
          'Capped at 85% (£544) by Strict Guardrail until receipt is packed for HMRC; unlocks 100% (£640) once proof is attached.',
        clarificationOptions: [
          {
            id: 'sony-100',
            label: '100% Work',
            businessPercentage: 100,
            taxRuleApplied: '100% AIA Relief',
          },
          {
            id: 'sony-60',
            label: '60% Split',
            businessPercentage: 60,
            taxRuleApplied: '60% Mixed Use',
          },
          {
            id: 'sony-0',
            label: 'Personal',
            businessPercentage: 0,
            taxRuleApplied: 'Excluded Personal',
          },
        ],
        taxRuleReference: 'Needs answer',
      },
      {
        id: 'exp-303',
        date: '25 Oct',
        merchantOrDescription: 'LNER & GWR Client Train App Screenshots',
        source: 'receipt',
        mediaFormat: 'screenshot',
        sourceDocumentName: 'trainline_app_screenshots.png',
        category: 'Travel',
        grossAmount: 680,
        businessPercentage: 100,
        aiSuggestedPercentage: 100,
        confidencePercent: 97,
        rawLineSnippet:
          'APP_SCREENSHOT: TRAINLINE LNER (4X RETURN LONDON-LEEDS) | £680.00',
        status: 'needs_clarification',
        aiContextNote: 'Trainline mobile ticket screenshots',
        aiQuestion: 'Were these LNER & GWR rail journeys for work, split, or personal?',
        whatWouldChangeMind:
          '100% allowable under SA103 Box 20 when matched to client project dates.',
        clarificationOptions: [
          {
            id: 'rail-100',
            label: '100% Work',
            businessPercentage: 100,
            taxRuleApplied: 'Deductible Travel (SA103 Box 20)',
          },
          {
            id: 'rail-50',
            label: '50% Split',
            businessPercentage: 50,
            taxRuleApplied: '50% Apportioned Rail Travel',
          },
          {
            id: 'rail-0',
            label: 'Personal',
            businessPercentage: 0,
            taxRuleApplied: 'Excluded Personal Travel',
          },
        ],
        taxRuleReference: 'Needs answer',
      },
    ],
  },
  {
    id: 'batch-invoices-sub',
    source: 'invoice',
    title: 'Proprietary Supplier Invoices',
    subtitle: '12 proprietary PDFs · Subcontractors & IP legal review',
    fileName: 'proprietary_invoices_2026.pdf',
    itemCount: 1,
    potentialTaxSaving: 680,
    ingested: false,
    itemsToUnlock: [
      {
        id: 'exp-305',
        date: '11 Oct',
        merchantOrDescription: 'Freelance CAD Subcontractor & Legal (Proprietary PDF)',
        source: 'invoice',
        mediaFormat: 'proprietary_invoice',
        sourceDocumentName: 'proprietary_invoices_2026.pdf',
        category: 'Professional Fees',
        grossAmount: 1620,
        businessPercentage: 100,
        aiSuggestedPercentage: 100,
        confidencePercent: 98,
        rawLineSnippet:
          'PROPRIETARY_INVOICE: CLARKE IP LAW (£620) + CAD PROTOTYPING (£1,000) = £1,620.00',
        status: 'needs_clarification',
        aiContextNote: 'Proprietary supplier PDF invoice (£1,620)',
        aiQuestion: 'Was this CAD subcontractor & IP legal invoice for work, split, or personal?',
        whatWouldChangeMind:
          '100% allowable under SA103 Box 28 for contract review & IP protection.',
        clarificationOptions: [
          {
            id: 'inv-100',
            label: '100% Work',
            businessPercentage: 100,
            taxRuleApplied: 'Deductible Professional Fees',
          },
          {
            id: 'inv-75',
            label: '75% Split',
            businessPercentage: 75,
            taxRuleApplied: '75% Apportioned Legal/Subcontractor',
          },
          {
            id: 'inv-0',
            label: 'Personal',
            businessPercentage: 0,
            taxRuleApplied: 'Excluded Personal',
          },
        ],
        taxRuleReference: 'Needs answer',
      },
    ],
  },
  {
    id: 'batch-mileage-q4',
    source: 'car_journey',
    title: 'Fuel Bills & Residence GPS Log',
    subtitle: 'Shell fuel bill from SW11 4AL (214 mi @ 48.5 MPG) & 940 GPS miles',
    fileName: 'gps_mileage_and_fuel.csv',
    itemCount: 3,
    potentialTaxSaving: 308,
    ingested: false,
    itemsToUnlock: [
      {
        id: 'exp-102',
        date: '14 Oct',
        merchantOrDescription: 'Shell Fuel Bill & Manchester Trips (214 Work Mi)',
        source: 'car_journey',
        mediaFormat: 'receipt_photo',
        sourceDocumentName: 'shell_fuel_and_gps_oct.png',
        category: 'Mileage',
        grossAmount: calculateHMRCMileageGross(214), // Dynamically computed: 214 * 0.45 = £96
        miles: 214,
        fuelMetadata: {
          userResidencePostcode: 'SW11 4AL (Battersea Residence)',
          destinationPostcode: 'M1 2BN (Manchester Client Site)',
          totalTripsCount: 6,
          workTripsCount: 4,
          isToFromResidenceCommute: false,
          distanceTravelledMiles: 214,
          carConsumptionMpg: 48.5,
          fuelLitresPurchased: 52.4,
        },
        businessPercentage: 100,
        aiSuggestedPercentage: 100,
        confidencePercent: 97,
        rawLineSnippet:
          'FUEL_RECEIPT+GPS: SHELL BATTERSEA £78.60 (52.4L @ 48.5 MPG) | RESIDENCE: SW11_4AL -> CLIENT: M1_2BN | 4/6 TRIPS FOR WORK = 214.0 BUSINESS MILES @ £0.45/MI = £96.30',
        status: 'needs_clarification',
        aiContextNote:
          'Residence SW11 4AL detected · 4/6 trips to client M1 2BN (214 mi @ 48.5 MPG)',
        aiQuestion:
          'How many of the 6 fuel trips from residence SW11 4AL were client visits vs. commuting?',
        whatWouldChangeMind:
          'Approve 100% of the 214 client miles (214 mi × £0.45 = £96 under ITTOIA 2005 s.94D) if trips were to temporary client site M1 2BN; reduce to 0% if ordinary commuting from residence SW11 4AL to a regular workplace (BIM37605).',
        clarificationOptions: [
          {
            id: 'trip-100',
            label: '100% Work (4/6)',
            businessPercentage: 100,
            taxRuleApplied: '45p/mi AMAP (ITTOIA s.94D)',
          },
          {
            id: 'trip-70',
            label: '70% Split',
            businessPercentage: 70,
            taxRuleApplied: '70% Fuel/Mileage Share',
          },
          {
            id: 'trip-0',
            label: 'Personal (£0)',
            businessPercentage: 0,
            taxRuleApplied: 'Excluded Residence Commute (BIM37605)',
          },
        ],
        taxRuleReference: 'Needs answer',
      },
      {
        id: 'exp-307',
        date: '19 Oct',
        merchantOrDescription: 'Heathrow T5 Parking Screenshot (£215)',
        source: 'car_journey',
        mediaFormat: 'screenshot',
        sourceDocumentName: 'heathrow_parking_screenshot.png',
        category: 'Travel',
        grossAmount: 215,
        businessPercentage: 100,
        aiSuggestedPercentage: 100,
        confidencePercent: 90,
        rawLineSnippet:
          'SCREENSHOT: 2026-10-19,POS,"HEATHROW AIRPORT PARKING T5",-215.00,GBP',
        status: 'needs_clarification',
        aiContextNote: 'Airport parking is deductible on top of 45p/mi mileage',
        aiQuestion: 'Was this airport parking for your Dublin client trip?',
        whatWouldChangeMind:
          'Approve 100% (£215) if flight boarding pass or Dublin client invoice matches 19 Oct dates.',
        clarificationOptions: [
          {
            id: 'park-100',
            label: '100% Work',
            businessPercentage: 100,
            taxRuleApplied: 'Deductible Parking',
          },
          {
            id: 'park-50',
            label: '50% Split',
            businessPercentage: 50,
            taxRuleApplied: '50% Trip Split',
          },
          {
            id: 'park-0',
            label: 'Personal',
            businessPercentage: 0,
            taxRuleApplied: 'Excluded Holiday',
          },
        ],
        taxRuleReference: 'Needs answer',
      },
      {
        id: 'exp-306',
        date: '03 Nov',
        merchantOrDescription: '940 Verified Client Site Miles (Excl. SW11 Commute)',
        source: 'car_journey',
        mediaFormat: 'gps_log',
        sourceDocumentName: 'gps_mileage_and_fuel.csv',
        category: 'Mileage',
        grossAmount: calculateHMRCMileageGross(940), // Dynamically computed: 940 * 0.45 = £423
        miles: 940,
        businessPercentage: 100,
        aiSuggestedPercentage: 100,
        confidencePercent: 96,
        rawLineSnippet:
          'GPS_BATCH: 940.0 MILES VERIFIED SITE VISITS @ £0.45/MI = £423.00',
        status: 'needs_clarification',
        aiContextNote: 'GPS mileage log from SW11 4AL',
        aiQuestion: 'Were these 940 GPS-logged miles 100% work visits, split, or personal?',
        whatWouldChangeMind:
          'Calculated in code at 45p/mi (940 × £0.45 = £423) under ITTOIA 2005 s.94D.',
        clarificationOptions: [
          {
            id: 'miles-100',
            label: '100% Work',
            businessPercentage: 100,
            taxRuleApplied: '45p/mi Allowance (ITTOIA s.94D)',
          },
          {
            id: 'miles-50',
            label: '50% Split',
            businessPercentage: 50,
            taxRuleApplied: '50% Mileage Share',
          },
          {
            id: 'miles-0',
            label: 'Personal',
            businessPercentage: 0,
            taxRuleApplied: 'Excluded Commute',
          },
        ],
        taxRuleReference: 'Needs answer',
      },
    ],
  },
];

export const UNSEEN_HOLDOUT_BATCH: ExpenseItem[] = [
  {
    id: 'exp-unseen-1',
    date: '06 Nov',
    merchantOrDescription: 'Formlabs 3D Prototyping Resin (Unseen Holdout)',
    source: 'invoice',
    mediaFormat: 'proprietary_invoice',
    sourceDocumentName: 'unseen_holdout_eval.csv',
    category: 'Materials',
    grossAmount: 820,
    businessPercentage: 100,
    aiSuggestedPercentage: 100,
    confidencePercent: 95,
    rawLineSnippet:
      'UNSEEN_EVAL_ROW #1: FORMLABS UK LTD | TOUGH 2000 RESIN 4L | £820.00',
    status: 'verified',
    selectedOptionLabel: '100% Work (Unseen Holdout)',
    taxRuleReference: 'ITTOIA s.34 Materials',
    whatWouldChangeMind:
      '100% direct consumable cost under SA103 Box 17 unless resin was used for non-commercial hobby items.',
  },
  {
    id: 'exp-unseen-2',
    date: '06 Nov',
    merchantOrDescription: 'Savile Row Bespoke Client Pitch Suit (Unseen Holdout)',
    source: 'receipt',
    mediaFormat: 'receipt_photo',
    sourceDocumentName: 'unseen_holdout_eval.csv',
    category: 'Clothing',
    grossAmount: 1150,
    businessPercentage: 0,
    aiSuggestedPercentage: 100, // AI saw "Client Pitch" and suggested 100%; Coded Block List forced to 0%!
    confidencePercent: 99,
    rawLineSnippet:
      'UNSEEN_EVAL_ROW #2: HUNTSMAN SAVILE ROW | BESPOKE SUIT | £1,150.00',
    status: 'blocked_by_guardrail',
    selectedOptionLabel: 'Blocked (Mallalieu v Drummond)',
    taxRuleReference: 'Blocked: Everyday Attire',
    guardrailBlockReason:
      'Hard-blocked by Coded Block List: Everyday business attire (even worn solely for client pitches) fails duality of purpose (Mallalieu v Drummond [1983]). Forced to £0.',
    whatWouldChangeMind:
      'Approve only if item is protective safety PPE (e.g. steel-toe boots, hi-vis) or a distinct costume/uniform bearing a permanent business logo (HMRC BIM37910).',
  },
];

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'log-1',
    timestamp: '09:25:02',
    actionType: 'INGEST',
    summary:
      'Loaded Demo User baseline ledger (6 verified multi-media transactions; 4 source files ready for upload-time AI Decision Tree classification)',
    mathTrace:
      'BaselineTax(£75,984) = £20,602 · OptimisedTax(£67,711) = £17,127',
  },
  {
    id: 'log-2',
    timestamp: '09:25:04',
    actionType: 'GUARDRAIL_ENFORCED',
    summary:
      'Coded Block List Enforced: Blocked £340 Fortnum & Mason Hamper to £0 (ITTOIA 2005 s.47 >£50 limit)',
    mathTrace:
      'Deductible forced to £0 · Avoided £186 tax clawback + 30% Sch.24 penalty',
  },
];
