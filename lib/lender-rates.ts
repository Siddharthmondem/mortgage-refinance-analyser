// ============================================================
// Refinance Clarity Engine — Lender Rate Scoring (Phase 2)
// ============================================================

import { runEngine } from "./comparison";
import { monthlyPayment } from "./amortization";
import type {
  LenderRate,
  ScoredLenderRate,
  EngineInput,
  CreditTier,
} from "./types";

// ---- Synthetic Lender Data ----

interface LenderProfile {
  name: string;
  spread30: number; // spread over PMMS 30yr (decimal)
  spread15: number; // spread over PMMS 15yr (decimal)
  feePercent: number; // closing costs as % of balance
  points: number;
}

const LENDER_PROFILES: LenderProfile[] = [
  { name: "Rocket Mortgage", spread30: -0.0015, spread15: -0.001, feePercent: 0.015, points: 0.5 },
  { name: "Better.com", spread30: 0.001, spread15: 0.0005, feePercent: 0.018, points: 0 },
  { name: "Wells Fargo", spread30: 0.003, spread15: 0.002, feePercent: 0.02, points: 0.75 },
  { name: "Chase", spread30: 0.005, spread15: 0.004, feePercent: 0.012, points: 0 },
  { name: "LoanDepot", spread30: 0.002, spread15: 0.0015, feePercent: 0.022, points: 0.25 },
  { name: "U.S. Bank", spread30: 0.004, spread15: 0.003, feePercent: 0.017, points: 0 },
];

const CREDIT_TIER_ADJUSTMENTS: Record<CreditTier, number> = {
  excellent: 0,
  good: 0.003,
  fair: 0.008,
};

/**
 * Generate synthetic lender rates based on PMMS + per-lender spreads.
 * Used as fallback when Zillow API is unavailable.
 */
export function generateSyntheticRates(
  pmms30yr: number,
  pmms15yr: number,
  creditTier: CreditTier,
  balance: number
): LenderRate[] {
  const creditAdj = CREDIT_TIER_ADJUSTMENTS[creditTier];
  const now = new Date().toISOString();

  return LENDER_PROFILES.map((lender, idx) => {
    const rate30 = pmms30yr / 100 + lender.spread30 + creditAdj;
    const fees = Math.round(balance * lender.feePercent);
    const mp = monthlyPayment(balance, rate30, 360);
    const apr = computeSimpleAPR(balance, rate30, 360, fees);

    return {
      id: `synthetic-${idx}`,
      lenderName: lender.name,
      rate: rate30,
      apr,
      monthlyPayment: mp,
      fees,
      points: lender.points,
      loanProgram: "30yr Fixed",
      lastUpdated: now,
    };
  });
}

/**
 * Simple APR approximation: amortizes closing costs into the rate.
 * Uses the formula: APR ≈ rate that makes PV of payments = (principal - fees).
 * Newton-Raphson iteration for accuracy.
 */
function computeSimpleAPR(
  principal: number,
  nominalRate: number,
  termMonths: number,
  fees: number
): number {
  if (fees <= 0) return nominalRate;

  const payment = monthlyPayment(principal, nominalRate, termMonths);
  const loanAmount = principal - fees; // effective amount received
  if (loanAmount <= 0) return nominalRate;

  // Newton-Raphson: find monthly rate r where PV(payments, r) = loanAmount
  let r = nominalRate / 12;
  for (let iter = 0; iter < 50; iter++) {
    const factor = Math.pow(1 + r, termMonths);
    const pv = payment * (factor - 1) / (r * factor);
    const pvDeriv =
      payment * ((termMonths * r * factor - (factor - 1) * (1 + termMonths * r)) / (r * r * factor * factor)) * factor;

    const diff = pv - loanAmount;
    if (Math.abs(diff) < 0.01) break;

    // Simplified derivative: dPV/dr
    const step = diff / (pvDeriv || 1);
    r += step * 0.5; // damped step for stability
    if (r <= 0) r = nominalRate / 12 * 0.999;
  }

  return r * 12;
}

/**
 * Score a single lender rate by running the engine with that rate.
 * Returns a ScoredLenderRate with verdict, savings, and break-even.
 */
export function scoreLenderRate(
  lender: LenderRate,
  userBalance: number,
  userCurrentRate: number,
  userYearsRemaining: number,
  userClosingCosts: number
): ScoredLenderRate {
  // Use the lender's rate as the quoted rate for all scenarios
  const lenderRateDecimal = lender.rate;

  // Use the lender's fees instead of user-entered closing costs
  const effectiveCosts = lender.fees > 0 ? lender.fees : userClosingCosts;

  const engineInput: EngineInput = {
    remainingBalance: userBalance,
    currentAnnualRate: userCurrentRate,
    yearsRemaining: userYearsRemaining,
    closingCosts: effectiveCosts,
    refiRateSameTerm: lenderRateDecimal,
    refiRate15yr: lenderRateDecimal - 0.005, // 15yr typically ~0.5% lower
    refiRate30yr: lenderRateDecimal,
  };

  const output = runEngine(engineInput);

  return {
    ...lender,
    fees: effectiveCosts,
    verdict: output.verdict,
    monthlySavings: -output.verdict.monthlyDelta, // positive = user saves
    breakEvenMonths: output.verdict.breakEvenMonths,
    totalSavings: output.verdict.netSavings,
    engineOutput: output,
  };
}

/**
 * Sort scored lender rates: green first (by savings desc), then yellow, then red.
 */
export function sortScoredRates(rates: ScoredLenderRate[]): ScoredLenderRate[] {
  const colorOrder: Record<string, number> = { green: 0, yellow: 1, red: 2 };
  return [...rates].sort((a, b) => {
    const colorDiff = (colorOrder[a.verdict.color] ?? 2) - (colorOrder[b.verdict.color] ?? 2);
    if (colorDiff !== 0) return colorDiff;
    return b.totalSavings - a.totalSavings; // higher savings first within same color
  });
}
