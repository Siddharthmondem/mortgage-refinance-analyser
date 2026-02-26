// ============================================================
// Refinance Clarity Engine — Break-Even Calculations
// ============================================================

import type { AmortizationRow } from "./types";

/**
 * Simple break-even: months to recoup closing costs via monthly payment savings.
 *
 * Formula: months = closingCosts / (baselinePayment − refiPayment)
 *
 * @returns break-even months (ceiled to integer), or null if no monthly savings
 */
export function simpleBreakEven(
  closingCosts: number,
  baselineMonthlyPayment: number,
  refiMonthlyPayment: number
): number | null {
  const monthlySavings = baselineMonthlyPayment - refiMonthlyPayment;
  if (monthlySavings <= 0) return null;
  if (closingCosts <= 0) return 0;
  return Math.ceil(closingCosts / monthlySavings);
}

/**
 * True break-even: month-by-month comparison of cumulative interest savings
 * vs closing costs.
 *
 * For each month m:
 *   cumulativeSavings[m] = Σ (baselineInterest[i] − refiInterest[i]) for i=1..m
 *   Find smallest m where cumulativeSavings[m] >= closingCosts
 *
 * @param baselineSchedule - amortization schedule for stay-current scenario
 * @param refiSchedule     - amortization schedule for refi scenario
 * @param closingCosts     - fees paid to refinance
 * @param horizonMonths    - max months to check
 * @returns break-even month (1-indexed), or null if never reached within horizon
 */
export function trueBreakEven(
  baselineSchedule: AmortizationRow[],
  refiSchedule: AmortizationRow[],
  closingCosts: number,
  horizonMonths: number
): number | null {
  if (closingCosts <= 0) return 0;

  const limit = Math.min(
    horizonMonths,
    baselineSchedule.length,
    refiSchedule.length
  );

  let cumulativeSavings = 0;

  for (let m = 0; m < limit; m++) {
    const baselineInterest = baselineSchedule[m].interestPaid;
    const refiInterest = refiSchedule[m].interestPaid;
    cumulativeSavings += baselineInterest - refiInterest;

    if (cumulativeSavings >= closingCosts) {
      return m + 1; // 1-indexed month
    }
  }

  return null; // never recouped within horizon
}
