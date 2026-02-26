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
  const N = Math.round(input.yearsRemaining * 12);
  const scenarios = generateScenarios(input);

  // Rank by totalCostWithinHorizon ascending
  const ranked = rankScenarios(scenarios);

  // Select winner (best non-baseline, or baseline if nothing beats it)
  const baseline = scenarios.find((s) => s.id === "stay_current")!;
  const winner = selectWinner(ranked, baseline);

  // Mark the winner
  for (const s of scenarios) {
    s.isBestLongTerm = s.id === winner.id;
  }

  // Generate verdict
  const verdict = generateVerdict(winner, baseline);

  return {
    input,
    horizonMonths: N,
    scenarios,
    verdict,
  };
}

/**
 * Rank scenarios by totalCostWithinHorizon ascending.
 * Baseline is included but may not be rank 1 if a refi is cheaper.
 */
export function rankScenarios(scenarios: ScenarioResult[]): ScenarioResult[] {
  return [...scenarios].sort(
    (a, b) => a.totalCostWithinHorizon - b.totalCostWithinHorizon
  );
}

/**
 * Select the winner scenario.
 *
 * Rules:
 * 1. Rank all scenarios by totalCostWithinHorizon ascending
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
 * Thresholds:
 *   GREEN:  break-even < 24 months AND net savings > $2,000
 *   YELLOW: break-even 24–48 months OR net savings $500–$2,000
 *   RED:    break-even > 48 months OR net savings < $500 OR negative
 */
export function generateVerdict(
  winner: ScenarioResult,
  baseline: ScenarioResult
): Verdict {
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

  // Use true break-even (month-by-month interest comparison) as primary.
  // Fall back to simple break-even if true is unavailable.
  // This correctly handles scenarios where monthly payment increases
  // but total interest savings still recoup fees quickly (e.g., 15-year refi).
  const breakEven = winner.trueBreakEvenMonths ?? winner.simpleBreakEvenMonths;
  const netSavings = winner.savingsVsBaseline;
  const monthlyDelta = winner.monthlyDelta;

  const color = determineColor(breakEven, netSavings);
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
  netSavings: number
): VerdictColor {
  // No monthly savings (break-even is null) or negative savings
  if (breakEven === null || netSavings < 0) return "red";

  // Green: break-even < 24 AND savings > $2,000
  if (breakEven < 24 && netSavings > 2000) return "green";

  // Yellow: break-even 24–48 OR savings $500–$2,000
  if (
    (breakEven >= 24 && breakEven <= 48) ||
    (netSavings >= 500 && netSavings <= 2000)
  ) {
    return "yellow";
  }

  // Red: break-even > 48 OR savings < $500
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
