export type RegulationPatchStatus =
  | 'pending_expert_approval'
  | 'approved_and_applied_to_code'
  | 'rejected_by_expert';

export type RegulationPatchCategory =
  | 'MILEAGE_ALLOWANCE_RATE'
  | 'CODED_BLOCK_LIST_RULE'
  | 'STATUTORY_RELIEF_THRESHOLD'
  | 'DUAL_USE_GUARDRAIL_CAP';

export interface HmrcRegulationChangeMessage {
  id: string;
  detectedAt: string;
  hmrcNoticeReference: string;
  hmrcManualSection: string;
  officialSourceUrl: string;
  category: RegulationPatchCategory;
  unreadByUser: boolean;
  status: RegulationPatchStatus;
  /** Notification headline shown to the taxpayer */
  userNotificationTitle: string;
  /** Plain-English explanation for the sole trader explaining what changed and that the programme will update pending expert approval */
  userNotificationSummary: string;
  /** Estimated impact on the user's current tax return once the hard-code change is approved */
  estimatedUserImpactLabel: string;
  /** Technical rationale for the Chartered Tax Adviser / Software Engineer reviewing the hard-code diff */
  expertTechnicalRationale: string;
  /** Target TypeScript file and function in the deterministic engine */
  targetFile: string;
  targetFunctionOrConstant: string;
  /** Current hard-coded TypeScript snippet */
  currentHardCodeSnippet: string;
  /** AI-proposed replacement hard-coded TypeScript snippet for experts to verify */
  proposedHardCodeSnippet: string;
  /** Mirrored Python (decimal + pandas) constant diff */
  proposedPythonDecimalDiff: string;
  /** Structured runtime parameter override applied to taxEngine.ts ONLY after expert approval */
  runtimeCodeOverride?: {
    mileageRateFirst10k?: number;
    flatHomeOfficeAnnualGbp?: number;
    homeOfficeMultiplierOverride?: number;
    additionalBlockListKeyword?: {
      id: string;
      categoryName: string;
      statutoryAuthority: string;
      keywords: string[];
      reason: string;
    };
  };
  expertReviewerName?: string;
  expertReviewedAt?: string;
  expertReviewComment?: string;
}

export const INITIAL_HMRC_REGULATION_MESSAGES: HmrcRegulationChangeMessage[] = [
  {
    id: 'hmrc-msg-2026-amap-48p',
    detectedAt: 'Today, 08:42 GMT',
    hmrcNoticeReference: 'Finance Act 2026 (Draft Clause 14) · SI 2026/114',
    hmrcManualSection: 'ITTOIA 2005 s.94D & HMRC BIM47701 (Simplified Mileage)',
    officialSourceUrl: 'https://www.gov.uk/simpler-income-tax-simplified-expenses',
    category: 'MILEAGE_ALLOWANCE_RATE',
    unreadByUser: true,
    status: 'pending_expert_approval',
    userNotificationTitle:
      'HMRC Regulation Change: Simplified Business Mileage Rate Uplifted (45p → 48p/mi)',
    userNotificationSummary:
      'Our AI Legislative Monitor detected an HMRC revision to ITTOIA 2005 s.94D increasing the Approved Mileage Allowance Payment (AMAP) rate for the first 10,000 business miles from 45p to 48p per mile. Because Taximiser never lets AI alter tax calculations directly, the AI has drafted a hard-code patch to src/utils/taxEngine.ts. Your programme will be updated automatically once approved by our Chartered Tax Adviser & Engineering review team.',
    estimatedUserImpactLabel:
      '+£35 additional allowable mileage write-off (+£15 tax saved on 1,154 logged business miles)',
    expertTechnicalRationale:
      'Updates HMRC_MILEAGE_RATE_FIRST_10K from 0.45 to 0.48 in src/utils/taxEngine.ts (and amap_rate in generatePythonDecimalScript). Preserves the 10,000-mile statutory tier boundary and 25p/mi upper band.',
    targetFile: 'src/utils/taxEngine.ts',
    targetFunctionOrConstant:
      'HMRC_MILEAGE_RATE_FIRST_10K & calculateHMRCMileageGross()',
    currentHardCodeSnippet: `// src/utils/taxEngine.ts (Lines 327-328 & 449-454)
export const HMRC_MILEAGE_RATE_FIRST_10K = 0.45;
export const HMRC_MILEAGE_RATE_ABOVE_10K = 0.25;

export function calculateHMRCMileageGross(miles: number): number {
  if (miles <= 0) return 0;
  const firstBand = Math.min(miles, 10000) * 0.45;
  const upperBand = Math.max(0, miles - 10000) * 0.25;
  return Math.round(firstBand + upperBand);
}`,
    proposedHardCodeSnippet: `// src/utils/taxEngine.ts (AI-Drafted Patch Pending Expert Sign-Off)
export const HMRC_MILEAGE_RATE_FIRST_10K = 0.48; // Updated: FA 2026 s.94D (48p/mi)
export const HMRC_MILEAGE_RATE_ABOVE_10K = 0.25;

export function calculateHMRCMileageGross(miles: number): number {
  if (miles <= 0) return 0;
  const firstBand = Math.min(miles, 10000) * 0.48;
  const upperBand = Math.max(0, miles - 10000) * 0.25;
  return Math.round(firstBand + upperBand);
}`,
    proposedPythonDecimalDiff: `- amap_rate = Decimal("0.45")
+ amap_rate = Decimal("0.48") # Finance Act 2026 s.94D uplift`,
    runtimeCodeOverride: {
      mileageRateFirst10k: 0.48,
    },
  },
  {
    id: 'hmrc-msg-2026-bim47820-home',
    detectedAt: 'Today, 08:15 GMT',
    hmrcNoticeReference: 'HMRC Policy Paper · BIM47820 Home-Working & Fibre Apportionment',
    hmrcManualSection: 'HMRC BIM47820 & ITTOIA 2005 s.94H',
    officialSourceUrl: 'https://www.gov.uk/hmrc-internal-manuals/business-income-manual/bim47820',
    category: 'STATUTORY_RELIEF_THRESHOLD',
    unreadByUser: true,
    status: 'pending_expert_approval',
    userNotificationTitle:
      'HMRC Guidance Update: Home Office Flat Rate (£6/wk → £10/wk) & Studio Utility Apportionment',
    userNotificationSummary:
      'HMRC published updated guidance under BIM47820 revising the unitemised flat-rate home-working baseline from £6/week (£312/yr) to £10/week (£520/yr) and confirming a 38% proportional utility floor for sole traders running high-draw CAD/3D equipment at home. The AI has proposed a hard-code update to the deterministic relief multiplier in src/utils/taxEngine.ts, currently pending expert approval.',
    estimatedUserImpactLabel:
      '+£144 additional proportional Home Office deduction (+£60 tax saved under BIM47820)',
    expertTechnicalRationale:
      'Updates the conventional flat-rate benchmark constant from £312 to £520 in computeTaxSummary() and increments the BIM47820 proportional studio utility multiplier from 0.35 to 0.38 for verified home studio setups.',
    targetFile: 'src/utils/taxEngine.ts',
    targetFunctionOrConstant:
      'computeTaxSummary() & getReliefDeductionAmount() (relief-home-office)',
    currentHardCodeSnippet: `// src/utils/taxEngine.ts (Lines 459-466 & 1208-1216)
export const FLAT_HOME_OFFICE_ANNUAL_GBP = 312; // £6/wk × 52 weeks
// relief-home-office rawInputs:
// rawBaseSpendGbp: 4800, statutoryMultiplier: 0.35 -> £1,680`,
    proposedHardCodeSnippet: `// src/utils/taxEngine.ts (AI-Drafted Patch Pending Expert Sign-Off)
export const FLAT_HOME_OFFICE_ANNUAL_GBP = 520; // Updated: £10/wk × 52 weeks (BIM47820)
// relief-home-office rawInputs:
// rawBaseSpendGbp: 4800, statutoryMultiplier: 0.38 -> £1,824 (+£144 allowable)`,
    proposedPythonDecimalDiff: `- statutory_multiplier = Decimal("0.35")
+ statutory_multiplier = Decimal("0.38") # Updated BIM47820 CAD/Studio floor`,
    runtimeCodeOverride: {
      flatHomeOfficeAnnualGbp: 520,
      homeOfficeMultiplierOverride: 0.38,
    },
  },
  {
    id: 'hmrc-msg-2026-spotlight65-block',
    detectedAt: 'Yesterday, 17:30 GMT',
    hmrcNoticeReference: 'HMRC Spotlight 65 · Compliance Brief 2026/09',
    hmrcManualSection: 'ITTOIA 2005 s.34 & HMRC BIM42526 (Personal Lifestyle & Wellness Clubs)',
    officialSourceUrl: 'https://www.gov.uk/guidance/tax-avoidance-don-t-get-caught-out',
    category: 'CODED_BLOCK_LIST_RULE',
    unreadByUser: true,
    status: 'pending_expert_approval',
    userNotificationTitle:
      'HMRC Compliance Alert: New Disallowance Rule for Private Wellness & Gym Memberships',
    userNotificationSummary:
      'HMRC issued Spotlight 65 clarifying that private health clubs, spa retreats, and gym memberships claimed by sole traders as "executive stress management" or "networking" fail the ITTOIA 2005 s.34 duality-of-purpose rule. The AI has drafted a new hard-coded rule for HMRC_CODED_BLOCK_LIST in src/utils/taxEngine.ts so such items are automatically forced to £0 once approved by our tax compliance team.',
    estimatedUserImpactLabel:
      'Protects against 30% FA 2007 Sch.24 careless inaccuracy penalties on lifestyle claims',
    expertTechnicalRationale:
      'Appends rule "block-private-gym-wellness" to HMRC_CODED_BLOCK_LIST in src/utils/taxEngine.ts. Ensures matchCodedBlockList() deterministically forces £0 even if a user inputs 100% business use.',
    targetFile: 'src/utils/taxEngine.ts',
    targetFunctionOrConstant: 'HMRC_CODED_BLOCK_LIST & matchCodedBlockList()',
    currentHardCodeSnippet: `// src/utils/taxEngine.ts (HMRC_CODED_BLOCK_LIST end of array)
  {
    id: 'block-ordinary-commuting',
    categoryName: 'Ordinary Home-to-Permanent-Workplace Commuting',
    statutoryAuthority: 'ITTOIA 2005 s.34 / HMRC BIM37605',
    keywords: ['ordinary commute to regular office', 'daily home to studio commute'],
    reason: 'Travel between residence and a permanent regular workplace is private commuting. Forced to £0.',
  },
];`,
    proposedHardCodeSnippet: `// src/utils/taxEngine.ts (AI-Drafted Patch Pending Expert Sign-Off)
  {
    id: 'block-ordinary-commuting',
    categoryName: 'Ordinary Home-to-Permanent-Workplace Commuting',
    statutoryAuthority: 'ITTOIA 2005 s.34 / HMRC BIM37605',
    keywords: ['ordinary commute to regular office', 'daily home to studio commute'],
    reason: 'Travel between residence and a permanent regular workplace is private commuting. Forced to £0.',
  },
  {
    id: 'block-private-gym-wellness',
    categoryName: 'Private Gym, Spa & Personal Wellness Clubs',
    statutoryAuthority: 'ITTOIA 2005 s.34 / HMRC Spotlight 65 & BIM42526',
    keywords: ['third space gym', 'david lloyd club', 'equinox membership', 'spa retreat'],
    reason: 'Personal fitness and wellness memberships fail duality of purpose under s.34. Forced to £0.',
  },
];`,
    proposedPythonDecimalDiff: `+ BLOCKED_KEYWORDS.extend(["third space gym", "david lloyd club", "equinox membership", "spa retreat"])`,
    runtimeCodeOverride: {
      additionalBlockListKeyword: {
        id: 'block-private-gym-wellness',
        categoryName: 'Private Gym, Spa & Personal Wellness Clubs',
        statutoryAuthority: 'ITTOIA 2005 s.34 / HMRC Spotlight 65 & BIM42526',
        keywords: [
          'third space gym',
          'david lloyd club',
          'equinox membership',
          'spa retreat',
        ],
        reason:
          'Personal fitness and wellness memberships fail duality of purpose under s.34. Forced to £0.',
      },
    },
  },
];

export const SIMULATED_NEW_HMRC_BULLETIN_PRESETS: Array<{
  presetId: string;
  buttonLabel: string;
  bulletinText: string;
  fallbackMessage: HmrcRegulationChangeMessage;
}> = [
  {
    presetId: 'aia_green_uplift',
    buttonLabel: 'Simulate HMRC Green Studio & AI Compute 100% First-Year Relief Update',
    bulletinText:
      'HMRC Capital Allowances Manual CA23110 Update (Nov 2026): Sole traders investing in energy-efficient local AI workstation GPUs or low-emission studio filtration units qualify for an enhanced 105% Eco-Hardware Capital Allowance multiplier under CAA 2001 s.45DA.',
    fallbackMessage: {
      id: 'hmrc-msg-2026-ca23110-eco',
      detectedAt: 'Just now (Live AI Scan)',
      hmrcNoticeReference: 'HMRC Capital Allowances Manual CA23110 · CAA 2001 s.45DA',
      hmrcManualSection: 'CAA 2001 s.45DA & s.51A (Eco-Compute & Clean Studio AIA)',
      officialSourceUrl: 'https://www.gov.uk/capital-allowances/first-year-allowances',
      category: 'STATUTORY_RELIEF_THRESHOLD',
      unreadByUser: true,
      status: 'pending_expert_approval',
      userNotificationTitle:
        'New HMRC Bulletin Detected: CAA 2001 s.45DA Clean Studio & Local Compute Relief',
      userNotificationSummary:
        'Our AI Legislative Monitor just scanned HMRC Capital Allowances Manual CA23110 and identified a new statutory update for energy-efficient studio and compute hardware. The programme has generated the hard-code diff for src/utils/taxEngine.ts and placed it in Pending Approval for a Chartered Tax Adviser to verify before updating your live calculation engine.',
      estimatedUserImpactLabel:
        'Unlocks enhanced Capital Allowance verification on studio hardware claims',
      expertTechnicalRationale:
        'Adds statutory citation CAA 2001 s.45DA to Node 2 of evaluateExpertDecisionTree() and updates the Capital Allowance constant in src/utils/taxEngine.ts.',
      targetFile: 'src/utils/taxEngine.ts',
      targetFunctionOrConstant: 'evaluateExpertDecisionTree() — Node 2 & AIA Relief',
      currentHardCodeSnippet: `// src/utils/taxEngine.ts
export const AIA_STATUTORY_MULTIPLIER = 1.00; // 100% CAA 2001 s.51A`,
      proposedHardCodeSnippet: `// src/utils/taxEngine.ts (AI-Drafted Patch Pending Expert Sign-Off)
export const AIA_STATUTORY_MULTIPLIER = 1.00; // 100% CAA 2001 s.51A
export const ECO_STUDIO_FY_ALLOWANCE_CITATION = 'CAA 2001 s.45DA & CA23110';`,
      proposedPythonDecimalDiff: `+ eco_studio_citation = "CAA 2001 s.45DA (Verified by Expert)"`,
    },
  },
];
