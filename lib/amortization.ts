// ============================================================
// Refinance Clarity Engine — Amortization Math
// ============================================================
// All formulas are standard fixed-rate amortization.
// No approximations — row-by-row schedule generation.
// ============================================================

import type { AmortizationRow } from "./types";

/**
 * Monthly payment for a fixed-rate fully-amortizing loan.
 *
 * Formula: M = P × [r(1+r)^n] / [(1+r)^n − 1]
 *
 * @param principal  - remaining loan balance ($)
 * @param annualRate - annual interest rate as decimal (0.065 = 6.5%)
 * @param termMonths - loan term in months
 * @returns monthly payment in dollars, rounded to 2 decimals
 */
export function monthlyPayment(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  if (principal <= 0) return 0;
  if (termMonths <= 0) return 0;
  if (annualRate <= 0) {
    // 0% interest: simple division
    return round2(principal / termMonths);
  }

  const r = annualRate / 12;
  const factor = Math.pow(1 + r, termMonths);
  const payment = principal * (r * factor) / (factor - 1);
  return round2(payment);
}

/**
 * Generate full month-by-month amortization schedule.
 *
 * @param principal  - remaining loan balance ($)
 * @param annualRate - annual interest rate as decimal
 * @param termMonths - loan term in months
 * @returns array of AmortizationRow (length = termMonths)
 */
export function amortizationSchedule(
  principal: number,
  annualRate: number,
  termMonths: number
): AmortizationRow[] {
  const pmt = monthlyPayment(principal, annualRate, termMonths);
  const r = annualRate / 12;
  const schedule: AmortizationRow[] = [];
  let balance = principal;

  for (let m = 1; m <= termMonths; m++) {
    const interest = round2(balance * r);
    // Last month: pay off remaining balance exactly
    const principalPaid = m === termMonths ? round2(balance) : round2(pmt - interest);
    balance = round2(balance - principalPaid);

    // Clamp negative balance from floating-point drift
    if (balance < 0) balance = 0;

    schedule.push({
      month: m,
      payment: m === termMonths ? round2(principalPaid + interest) : pmt,
      principalPaid,
      interestPaid: interest,
      remainingBalance: balance,
    });
  }

  return schedule;
}

/**
 * Total interest paid within a range of months [1..k] from a schedule.
 *
 * @param schedule - amortization schedule
 * @param k        - number of months to sum (capped at schedule length)
 * @returns total interest in dollars
 */
export function totalInterestWithinMonths(
  schedule: AmortizationRow[],
  k: number
): number {
  const limit = Math.min(k, schedule.length);
  let total = 0;
  for (let i = 0; i < limit; i++) {
    total += schedule[i].interestPaid;
  }
  return round2(total);
}

/**
 * Remaining principal balance at month k.
 *
 * @param schedule - amortization schedule
 * @param k        - month number (1-indexed)
 * @returns remaining balance at end of month k, or 0 if k >= schedule length
 */
export function remainingBalanceAtMonth(
  schedule: AmortizationRow[],
  k: number
): number {
  if (k <= 0) return schedule.length > 0 ? round2(schedule[0].remainingBalance + schedule[0].principalPaid) : 0;
  if (k >= schedule.length) return 0;
  return schedule[k - 1].remainingBalance;
}

/**
 * Closed-form remaining balance at month k.
 * Useful for quick computation without full schedule.
 *
 * Formula: B_k = P(1+r)^k − M × [(1+r)^k − 1] / r
 *
 * @param principal  - original loan balance
 * @param annualRate - annual rate as decimal
 * @param termMonths - full loan term
 * @param atMonth    - month to compute balance at
 * @returns remaining balance
 */
export function remainingBalanceClosedForm(
  principal: number,
  annualRate: number,
  termMonths: number,
  atMonth: number
): number {
  if (atMonth <= 0) return principal;
  if (atMonth >= termMonths) return 0;

  const r = annualRate / 12;
  const pmt = monthlyPayment(principal, annualRate, termMonths);

  if (r <= 0) {
    return round2(principal - pmt * atMonth);
  }

  const factor = Math.pow(1 + r, atMonth);
  const balance = principal * factor - pmt * (factor - 1) / r;
  return round2(Math.max(balance, 0));
}

/**
 * Interest paid within horizon using closed-form.
 *
 * interestWithinK = P*k_payments − (B_0 − B_k)
 * where k_payments = sum of payments within k months = P_monthly × min(k, termMonths)
 *
 * More precisely: totalPayments − totalPrincipalPaid = totalInterest
 * totalPrincipalPaid = B_0 − B_k
 *
 * @param principal  - loan balance
 * @param annualRate - annual rate
 * @param termMonths - full loan term
 * @param horizonMonths - comparison horizon
 * @returns interest paid within horizon
 */
export function interestWithinHorizonClosedForm(
  principal: number,
  annualRate: number,
  termMonths: number,
  horizonMonths: number
): number {
  const k = Math.min(horizonMonths, termMonths);
  const pmt = monthlyPayment(principal, annualRate, termMonths);
  const balanceAtK = remainingBalanceClosedForm(principal, annualRate, termMonths, k);
  const totalPayments = pmt * k;
  const totalPrincipalPaid = principal - balanceAtK;
  return round2(totalPayments - totalPrincipalPaid);
}

// ---- Utility ----

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
