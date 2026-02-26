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
  totalCostWithinHorizon: number; // interest + fees within horizon
  savingsVsBaseline: number; // positive = cheaper than baseline
  simpleBreakEvenMonths: number | null;
  trueBreakEvenMonths: number | null;
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
