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

  const N        = input.horizonOverrideMonths ?? Math.round(Y * 12); // comparison horizon
  const fullTerm = Math.round(Y * 12);                                 // actual remaining loan term

  // ---- Scenario 0: Stay Current (Baseline) ----
  const baseline = buildScenario({
    id: "stay_current",
    label: "Stay Current",
    principal: B,
    rate: rc,
    termMonths: fullTerm, // full remaining term, not the horizon
    horizonMonths: N,
    fees: 0,
    baselinePayment: 0, // will be set after
    baselineSchedule: [], // will be set after
  });

  // Baseline reference values
  const basePayment = baseline.monthlyPayment;
  const baseSchedule = amortizationSchedule(B, rc, fullTerm);

  // Finalize baseline deltas (always 0 vs itself)
  baseline.monthlyDelta = 0;
  baseline.netSavingsAtHorizon = 0;
  baseline.cashflowBreakEvenMonths = null;
  baseline.interestBreakEvenMonths = null;

  const scenarios: ScenarioResult[] = [baseline];

  // ---- Scenario 1: Refi Same Term ----
  if (rSame < rc) {
    const sc = buildScenario({
      id: "refi_same_term",
      label: "Refi (Same Term)",
      principal: B,
      rate: rSame,
      termMonths: fullTerm, // same remaining term as baseline
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

    // Add term reset warning — "trap" for full-term horizon, "tradeoff" for short-horizon
    if (sc30.remainingBalanceAtHorizon > 0) {
      const isFullTerm = !input.horizonOverrideMonths;
      if (isFullTerm) {
        sc30.warnings.push(
          `Term Reset Trap: You would still owe $${formatNumber(sc30.remainingBalanceAtHorizon)} when your original loan would have been paid off.`
        );
      } else {
        const horizonYrs = Math.round((input.horizonOverrideMonths ?? N) / 12);
        sc30.warnings.push(
          `Term Reset Tradeoff: At your ${horizonYrs}-year horizon, you'd exit with $${formatNumber(sc30.remainingBalanceAtHorizon)} still owed. The 30-year extends your payoff date but lowers your monthly payment.`
        );
      }
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

  // New cost fields
  const paymentsWithinHorizon = round2(pmt * k);
  const cashOutflowWithinHorizon = round2(fees + paymentsWithinHorizon);
  const netCostAtHorizon = round2(cashOutflowWithinHorizon + remBalance);

  // Deltas vs baseline
  const monthlyDelta = round2(pmt - params.baselinePayment);

  // Savings = baseline netCost - this netCost
  // Since netCostAtHorizon = fees + interest + B (B = original balance, constant),
  // this equals (baseline interest) - (fees + this interest) — same as before.
  const baselineInterest =
    params.baselineSchedule.length > 0
      ? round2(totalInterestWithinMonths(params.baselineSchedule, horizonMonths))
      : 0;
  const baselineNetCost = round2(baselineInterest); // baseline fees = 0
  const thisLegacyCost = round2(interestInHorizon + fees);
  const netSavingsAtHorizon = round2(baselineNetCost - thisLegacyCost);

  // Break-even
  const cashflowBE = simpleBreakEven(fees, params.baselinePayment, pmt);
  const interestBE =
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
    paymentsWithinHorizon,
    cashOutflowWithinHorizon,
    netCostAtHorizon,
    netSavingsAtHorizon,
    cashflowBreakEvenMonths: cashflowBE,
    interestBreakEvenMonths: interestBE,
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
