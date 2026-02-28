// ============================================================
// Refinance Clarity Engine — Type Definitions
// ============================================================

/** Scenario identifiers */
export type ScenarioId =
  | "stay_current"
  | "refi_same_term"
  | "refi_15yr"
  | "refi_30yr";

/** Credit quality tier */
export type CreditTier = "excellent" | "good" | "fair";

/** Verdict color */
export type VerdictColor = "green" | "yellow" | "red";

// ---- Inputs ----

export interface LoanInput {
  remainingBalance: number; // dollars
  currentAnnualRate: number; // decimal, e.g. 0.065 for 6.5%
  yearsRemaining: number; // integer or half-year
  closingCosts: number; // dollars (default = 2% of balance)
}

export interface EngineInput extends LoanInput {
  /** Refi rate for "same remaining term" scenario (decimal) */
  refiRateSameTerm: number;
  /** Refi rate for 15-year scenario (decimal) */
  refiRate15yr: number;
  /** Refi rate for 30-year scenario (decimal) */
  refiRate30yr: number;
  /** Override the comparison horizon in months. Defaults to yearsRemaining × 12. */
  horizonOverrideMonths?: number;
}

// ---- Amortization ----

export interface AmortizationRow {
  month: number;
  payment: number;
  principalPaid: number;
  interestPaid: number;
  remainingBalance: number;
}

// ---- Scenario Output ----

export interface ScenarioResult {
  id: ScenarioId;
  label: string;
  rate: number; // annual rate (decimal)
  termMonths: number; // full loan term in months
  monthlyPayment: number;
  monthlyDelta: number; // vs baseline (negative = savings)
  interestWithinHorizon: number; // total interest paid within comparison horizon
  fees: number; // closing costs (0 for baseline)
  remainingBalanceAtHorizon: number; // principal still owed at horizon end
  /** Total payments made within horizon: pmt × min(termMonths, N) */
  paymentsWithinHorizon: number;
  /** Cash paid out of pocket: fees + paymentsWithinHorizon */
  cashOutflowWithinHorizon: number;
  /** Total economic commitment at horizon exit: cashOutflowWithinHorizon + remainingBalanceAtHorizon */
  netCostAtHorizon: number;
  /** Positive = cheaper than baseline (vs baseline netCostAtHorizon) */
  netSavingsAtHorizon: number;
  /** Months to recoup via payment savings (null if payment increases) */
  cashflowBreakEvenMonths: number | null;
  /** Months to recoup via interest savings (preferred; null if not reachable within horizon) */
  interestBreakEvenMonths: number | null;
  isBestLongTerm: boolean;
  warnings: string[];
}

// ---- Verdict ----

export interface Verdict {
  color: VerdictColor;
  label: string;
  message: string;
  breakEvenMonths: number | null;
  monthlyDelta: number;
  netSavings: number;
  bestScenarioId: ScenarioId;
}

// ---- Full Engine Output ----

export interface EngineOutput {
  input: EngineInput;
  horizonMonths: number;
  scenarios: ScenarioResult[];
  verdict: Verdict;
}

// ---- Rate Data (from Freddie Mac PMMS) ----

export interface RateData {
  source: "freddie_mac_pmms";
  fetched_at: string; // ISO 8601
  rates: {
    fixed_30yr: number; // percentage, e.g. 6.85 for 6.85%
    fixed_15yr: number;
  };
}

// ---- Lender Rates (Phase 2) ----

export interface LenderRate {
  id: string;
  lenderName: string;
  rate: number; // decimal, e.g. 0.0625 for 6.25%
  apr: number; // decimal
  monthlyPayment: number;
  fees: number; // total closing costs in dollars
  points: number; // discount points (0, 0.5, 1, etc.)
  loanProgram: string; // "30yr Fixed", "15yr Fixed"
  lastUpdated: string; // ISO 8601
}

export interface ScoredLenderRate extends LenderRate {
  verdict: Verdict;
  monthlySavings: number; // positive = user saves
  breakEvenMonths: number | null;
  totalSavings: number;
  engineOutput: EngineOutput;
}

// ---- Market Rate Provenance (Phase 2.5) ----

/** How rates were obtained */
export type RateSource = "live" | "cached" | "fallback";

/** Response from /api/market-rates */
export interface MarketRatesResponse {
  rates: RateData;
  rateSource: RateSource;
  ageDescription: string; // e.g., "Updated 2 hours ago"
}

/** Transparent rate breakdown shown in results UI */
export interface RateBreakdown {
  rateSource: RateSource;
  baseRate30yr: number; // percentage, e.g. 5.98
  baseRate15yr: number; // percentage, e.g. 5.44
  fetchedAt: string; // ISO 8601 timestamp
  creditSpread30: number; // decimal, e.g. 0.005
  creditSpread15: number; // decimal, e.g. 0.004
  finalRateSameTerm: number; // decimal, e.g. 0.0623
  finalRate15yr: number; // decimal
  finalRate30yr: number; // decimal
  usingQuotedRate: boolean;
  quotedRate?: number; // decimal, only if user provided a quoted rate
}
