// ============================================================
// Refinance Clarity Engine — Scenario Engine
// ============================================================
// Generates all comparison scenarios from user input.
// ============================================================

import {
  monthlyPayment,
  amortizationSchedule,
  totalInterestWithinMonths,
  remainingBalanceAtMonth,
} from "./amortization";
import { simpleBreakEven, trueBreakEven } from "./breakeven";
import type { EngineInput, ScenarioResult, AmortizationRow } from "./types";

/**
 * Generate all applicable scenarios from engine input.
 *
 * Scenarios:
 *   0) Stay current (baseline)
 *   1) Refi same term — only if refiRateSameTerm < currentRate
 *   2) Refi 15-year   — only if yearsRemaining > 15 AND refiRate15yr < currentRate
 *   3) Refi 30-year   — only if refiRate30yr < currentRate
 *
 * @returns array of ScenarioResult, always starting with baseline
 */
export function generateScenarios(input: EngineInput): ScenarioResult[] {
  const {
    remainingBalance: B,
    currentAnnualRate: rc,
    yearsRemaining: Y,
    closingCosts: F,
    refiRateSameTerm: rSame,
    refiRate15yr: r15,
    refiRate30yr: r30,
  } = input;

  const N = Math.round(Y * 12); // horizon months

  // ---- Scenario 0: Stay Current (Baseline) ----
  const baseline = buildScenario({
    id: "stay_current",
    label: "Stay Current",
    principal: B,
    rate: rc,
    termMonths: N,
    horizonMonths: N,
    fees: 0,
    baselinePayment: 0, // will be set after
    baselineSchedule: [], // will be set after
  });

  // Baseline reference values
  const basePayment = baseline.monthlyPayment;
  const baseSchedule = amortizationSchedule(B, rc, N);

  // Finalize baseline deltas (always 0 vs itself)
  baseline.monthlyDelta = 0;
  baseline.savingsVsBaseline = 0;
  baseline.simpleBreakEvenMonths = null;
  baseline.trueBreakEvenMonths = null;

  const scenarios: ScenarioResult[] = [baseline];

  // ---- Scenario 1: Refi Same Term ----
  if (rSame < rc) {
    const sc = buildScenario({
      id: "refi_same_term",
      label: "Refi (Same Term)",
      principal: B,
      rate: rSame,
      termMonths: N,
      horizonMonths: N,
      fees: F,
      baselinePayment: basePayment,
      baselineSchedule: baseSchedule,
    });
    scenarios.push(sc);
  }

  // ---- Scenario 2: Refi 15-Year ----
  if (Y > 15 && r15 < rc) {
    const sc = buildScenario({
      id: "refi_15yr",
      label: "Refi (15-Year)",
      principal: B,
      rate: r15,
      termMonths: 180,
      horizonMonths: N,
      fees: F,
      baselinePayment: basePayment,
      baselineSchedule: baseSchedule,
    });
    scenarios.push(sc);
  }

  // ---- Scenario 3: Refi 30-Year Reset ----
  if (r30 < rc) {
    const sc30 = buildScenario({
      id: "refi_30yr",
      label: "Refi (30-Year Reset)",
      principal: B,
      rate: r30,
      termMonths: 360,
      horizonMonths: N,
      fees: F,
      baselinePayment: basePayment,
      baselineSchedule: baseSchedule,
    });

    // Add term reset trap warning
    if (sc30.remainingBalanceAtHorizon > 0) {
      sc30.warnings.push(
        `Term Reset Trap: You would still owe $${formatNumber(sc30.remainingBalanceAtHorizon)} when your original loan would have been paid off.`
      );
    }

    scenarios.push(sc30);
  }

  return scenarios;
}

// ---- Internal Builder ----

interface BuildParams {
  id: ScenarioResult["id"];
  label: string;
  principal: number;
  rate: number;
  termMonths: number;
  horizonMonths: number;
  fees: number;
  baselinePayment: number;
  baselineSchedule: AmortizationRow[];
}

function buildScenario(params: BuildParams): ScenarioResult {
  const { id, label, principal, rate, termMonths, horizonMonths, fees } = params;

  const pmt = monthlyPayment(principal, rate, termMonths);
  const schedule = amortizationSchedule(principal, rate, termMonths);

  const k = Math.min(horizonMonths, termMonths);
  const interestInHorizon = totalInterestWithinMonths(schedule, k);

  // Remaining balance at the horizon end
  // If the loan term is shorter than or equal to horizon, balance = 0
  const remBalance =
    termMonths <= horizonMonths ? 0 : remainingBalanceAtMonth(schedule, horizonMonths);

  const totalCost = round2(interestInHorizon + fees);

  // Deltas vs baseline
  const monthlyDelta = round2(pmt - params.baselinePayment);

  // Savings = baseline total cost - this scenario total cost
  // Baseline total cost is computed separately; for now set to 0 and
  // recalculate in generateScenarios after baseline is built.
  // For baseline itself, savings = 0.
  const baselineTotalCost =
    params.baselineSchedule.length > 0
      ? round2(totalInterestWithinMonths(params.baselineSchedule, horizonMonths))
      : 0;
  const savings = round2(baselineTotalCost - totalCost);

  // Break-even
  const simpleBE = simpleBreakEven(fees, params.baselinePayment, pmt);
  const trueBE =
    params.baselineSchedule.length > 0
      ? trueBreakEven(params.baselineSchedule, schedule, fees, horizonMonths)
      : null;

  return {
    id,
    label,
    rate,
    termMonths,
    monthlyPayment: pmt,
    monthlyDelta,
    interestWithinHorizon: interestInHorizon,
    fees,
    remainingBalanceAtHorizon: remBalance,
    totalCostWithinHorizon: totalCost,
    savingsVsBaseline: savings,
    simpleBreakEvenMonths: simpleBE,
    trueBreakEvenMonths: trueBE,
    isBestLongTerm: false, // set by comparison engine
    warnings: [],
  };
}

// ---- Utilities ----

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
