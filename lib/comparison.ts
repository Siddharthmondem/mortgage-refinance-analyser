// ============================================================
// Refinance Clarity Engine — Comparison & Verdict Logic
// ============================================================

import type {
  ScenarioResult,
  Verdict,
  VerdictColor,
  EngineInput,
  EngineOutput,
} from "./types";
import { generateScenarios } from "./scenarios";

/**
 * Run the full engine: generate scenarios, rank, select winner, produce verdict.
 *
 * @param input - validated EngineInput
 * @returns EngineOutput with all scenarios and verdict
 */
export function runEngine(input: EngineInput): EngineOutput {
  const N = input.horizonOverrideMonths ?? Math.round(input.yearsRemaining * 12);
  const scenarios = generateScenarios(input);

  // Rank by netCostAtHorizon ascending
  const ranked = rankScenarios(scenarios);

  // Select winner (best non-baseline, or baseline if nothing beats it)
  const baseline = scenarios.find((s) => s.id === "stay_current")!;
  const winner = selectWinner(ranked, baseline);

  // Mark the winner
  for (const s of scenarios) {
    s.isBestLongTerm = s.id === winner.id;
  }

  // Generate verdict (pass horizonMonths for relative thresholds)
  const verdict = generateVerdict(winner, baseline, N);

  return {
    input,
    horizonMonths: N,
    scenarios,
    verdict,
  };
}

/**
 * Rank scenarios by netCostAtHorizon ascending.
 * Baseline is included but may not be rank 1 if a refi is cheaper.
 */
export function rankScenarios(scenarios: ScenarioResult[]): ScenarioResult[] {
  return [...scenarios].sort(
    (a, b) => a.netCostAtHorizon - b.netCostAtHorizon
  );
}

/**
 * Select the winner scenario.
 *
 * Rules:
 * 1. Rank all scenarios by netCostAtHorizon ascending
 * 2. The winner is the cheapest scenario
 * 3. If the cheapest scenario IS the baseline, the winner is baseline
 *    → "Staying put is your best move"
 */
export function selectWinner(
  ranked: ScenarioResult[],
  baseline: ScenarioResult
): ScenarioResult {
  if (ranked.length === 0) return baseline;

  const best = ranked[0]!;

  // If baseline is the cheapest (or tied), stay current wins
  if (best.id === "stay_current") return baseline;

  // If a refi scenario is cheaper, it wins — but add payment increase warning if needed
  if (best.monthlyPayment > baseline.monthlyPayment) {
    const delta = round2(best.monthlyPayment - baseline.monthlyPayment);
    const existing = best.warnings.find((w) => w.startsWith("Payment Increase"));
    if (!existing) {
      best.warnings.push(
        `Payment Increase Warning: +$${formatNumber(delta)}/mo higher than your current payment.`
      );
    }
  }

  return best;
}

/**
 * Generate the verdict object based on winner vs baseline.
 *
 * Thresholds are relative to horizonMonths:
 *   GREEN:  break-even ratio < 0.33 AND savings > $200 × horizonYears
 *   YELLOW: break-even ratio < 0.67 AND savings > $50 × horizonYears
 *   RED:    break-even > horizon, ratio ≥ 0.67, or savings too low
 */
export function generateVerdict(
  winner: ScenarioResult,
  baseline: ScenarioResult,
  horizonMonths: number
): Verdict {
  // Suppress unused baseline param warning — kept for future use
  void baseline;

  // If baseline is the winner, always red
  if (winner.id === "stay_current") {
    return {
      color: "red",
      label: "Stay With Your Current Loan",
      message:
        "At the provided rates, refinancing would not save you money after accounting for closing costs. Your current loan is your best option.",
      breakEvenMonths: null,
      monthlyDelta: 0,
      netSavings: 0,
      bestScenarioId: "stay_current",
    };
  }

  // Use interest break-even (month-by-month comparison) as primary.
  // Fall back to cashflow break-even if interest is unavailable.
  const breakEven = winner.interestBreakEvenMonths ?? winner.cashflowBreakEvenMonths;
  const netSavings = winner.netSavingsAtHorizon;
  const monthlyDelta = winner.monthlyDelta;

  const color = determineColor(breakEven, netSavings, horizonMonths);
  const label = verdictLabel(color);
  const message = verdictMessage(color, winner, breakEven, netSavings);

  return {
    color,
    label,
    message,
    breakEvenMonths: breakEven,
    monthlyDelta,
    netSavings,
    bestScenarioId: winner.id,
  };
}

function determineColor(
  breakEven: number | null,
  netSavings: number,
  horizonMonths: number
): VerdictColor {
  const horizonYears = horizonMonths / 12;

  // Negative savings or no break-even achievable
  if (breakEven === null || netSavings < 0) return "red";

  // Break-even never occurs within the selected horizon
  if (breakEven > horizonMonths) return "red";

  const ratio = breakEven / horizonMonths;
  const greenSavingsThreshold = 200 * horizonYears; // $600 at 3yr, $2k at 10yr
  const yellowSavingsThreshold = 50 * horizonYears;  // $150 at 3yr, $500 at 10yr

  // Green: recoup within first 1/3 of horizon AND meaningful savings
  if (ratio < 0.33 && netSavings > greenSavingsThreshold) return "green";

  // Yellow: recoup within first 2/3 of horizon AND some savings
  if (ratio < 0.67 && netSavings > yellowSavingsThreshold) return "yellow";

  return "red";
}

function verdictLabel(color: VerdictColor): string {
  switch (color) {
    case "green":
      return "Refinance Looks Strong";
    case "yellow":
      return "Worth a Closer Look";
    case "red":
      return "Stay With Your Current Loan";
  }
}

function verdictMessage(
  color: VerdictColor,
  winner: ScenarioResult,
  breakEven: number | null,
  netSavings: number
): string {
  const monthlyAbs = Math.abs(winner.monthlyDelta);
  const monthlyDir = winner.monthlyDelta < 0 ? "less" : "more";
  const savingsAbs = Math.abs(netSavings);

  switch (color) {
    case "green":
      return (
        `You'd recoup closing costs in ${breakEven} months and pay $${formatNumber(monthlyAbs)}/mo ${monthlyDir}. ` +
        `Over the comparison horizon, that's $${formatNumber(savingsAbs)} less in total cost. ` +
        `Best option: ${winner.label}.`
      );
    case "yellow":
      return (
        `Refinancing could save you $${formatNumber(savingsAbs)} overall, ` +
        `but it would take ${breakEven ?? "N/A"} months to break even on closing costs. ` +
        `Monthly payment would be $${formatNumber(monthlyAbs)}/mo ${monthlyDir}.`
      );
    case "red":
      if (netSavings < 0) {
        return (
          `At these rates, refinancing would cost you $${formatNumber(savingsAbs)} more ` +
          `over your remaining loan term after accounting for closing costs.`
        );
      }
      return (
        `The potential savings of $${formatNumber(savingsAbs)} are modest relative to closing costs. ` +
        `Break-even would take ${breakEven ?? "N/A"} months.`
      );
  }
}

// ---- Utilities ----

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
