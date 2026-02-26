// ============================================================
// Amortization Engine — Unit Tests
// ============================================================

import { describe, it, expect } from "vitest";
import {
  monthlyPayment,
  amortizationSchedule,
  totalInterestWithinMonths,
  remainingBalanceAtMonth,
  remainingBalanceClosedForm,
  interestWithinHorizonClosedForm,
} from "../lib/amortization";

describe("monthlyPayment", () => {
  it("computes standard 30yr fixed correctly", () => {
    // $300,000 at 6.5% for 30 years = $1,896.20
    const pmt = monthlyPayment(300_000, 0.065, 360);
    expect(pmt).toBeCloseTo(1896.2, 0);
  });

  it("computes 15yr fixed correctly", () => {
    // $300,000 at 5.75% for 15 years = $2,491.05
    const pmt = monthlyPayment(300_000, 0.0575, 180);
    expect(pmt).toBeCloseTo(2491.05, 0);
  });

  it("computes short-term loan", () => {
    // $50,000 at 6% for 5 years = $966.64
    const pmt = monthlyPayment(50_000, 0.06, 60);
    expect(pmt).toBeCloseTo(966.64, 0);
  });

  it("handles 0% interest", () => {
    const pmt = monthlyPayment(120_000, 0, 360);
    expect(pmt).toBeCloseTo(333.33, 0);
  });

  it("returns 0 for zero principal", () => {
    expect(monthlyPayment(0, 0.06, 360)).toBe(0);
  });

  it("returns 0 for zero term", () => {
    expect(monthlyPayment(100_000, 0.06, 0)).toBe(0);
  });
});

describe("amortizationSchedule", () => {
  it("produces correct number of rows", () => {
    const schedule = amortizationSchedule(200_000, 0.065, 240);
    expect(schedule).toHaveLength(240);
  });

  it("final balance is 0", () => {
    const schedule = amortizationSchedule(300_000, 0.065, 360);
    const last = schedule[schedule.length - 1]!;
    expect(last.remainingBalance).toBe(0);
  });

  it("sum of principal payments equals original balance", () => {
    const schedule = amortizationSchedule(250_000, 0.07, 300);
    const totalPrincipal = schedule.reduce((s, r) => s + r.principalPaid, 0);
    expect(totalPrincipal).toBeCloseTo(250_000, 0);
  });

  it("first month interest is correct", () => {
    // $300,000 × 0.065/12 = $1,625.00
    const schedule = amortizationSchedule(300_000, 0.065, 360);
    expect(schedule[0]!.interestPaid).toBeCloseTo(1625.0, 0);
  });

  it("interest decreases over time", () => {
    const schedule = amortizationSchedule(200_000, 0.06, 360);
    expect(schedule[0]!.interestPaid).toBeGreaterThan(
      schedule[359]!.interestPaid
    );
  });
});

describe("totalInterestWithinMonths", () => {
  it("full term interest matches expected", () => {
    // $200,000 at 6% for 30yr: total interest ≈ $231,676
    const schedule = amortizationSchedule(200_000, 0.06, 360);
    const total = totalInterestWithinMonths(schedule, 360);
    expect(total).toBeCloseTo(231_676, -2); // within $100
  });

  it("partial horizon returns less interest", () => {
    const schedule = amortizationSchedule(200_000, 0.06, 360);
    const full = totalInterestWithinMonths(schedule, 360);
    const half = totalInterestWithinMonths(schedule, 180);
    expect(half).toBeLessThan(full);
    expect(half).toBeGreaterThan(0);
  });
});

describe("remainingBalanceAtMonth", () => {
  it("balance at month 0 is original principal", () => {
    const schedule = amortizationSchedule(300_000, 0.065, 360);
    // Month 0 = before any payments
    const bal = remainingBalanceAtMonth(schedule, 0);
    expect(bal).toBeCloseTo(300_000, 0);
  });

  it("balance at final month is 0", () => {
    const schedule = amortizationSchedule(300_000, 0.065, 360);
    expect(remainingBalanceAtMonth(schedule, 360)).toBe(0);
  });

  it("balance at mid-term for 30yr refi over 20yr horizon", () => {
    // $300,000 at 6% for 30 years, check balance at month 240 (year 20)
    const schedule = amortizationSchedule(300_000, 0.06, 360);
    const bal = remainingBalanceAtMonth(schedule, 240);
    // Should still owe significant amount
    expect(bal).toBeGreaterThan(100_000);
    expect(bal).toBeLessThan(250_000);
  });
});

describe("remainingBalanceClosedForm", () => {
  it("matches schedule-based balance", () => {
    const schedule = amortizationSchedule(300_000, 0.065, 360);
    const scheduleBal = remainingBalanceAtMonth(schedule, 120);
    const closedBal = remainingBalanceClosedForm(300_000, 0.065, 360, 120);
    expect(closedBal).toBeCloseTo(scheduleBal, 0);
  });

  it("returns 0 at end of term", () => {
    const bal = remainingBalanceClosedForm(200_000, 0.06, 360, 360);
    expect(bal).toBe(0);
  });

  it("returns principal at month 0", () => {
    const bal = remainingBalanceClosedForm(200_000, 0.06, 360, 0);
    expect(bal).toBe(200_000);
  });
});

describe("interestWithinHorizonClosedForm", () => {
  it("matches schedule-based interest for full term", () => {
    const schedule = amortizationSchedule(200_000, 0.06, 360);
    const scheduleInterest = totalInterestWithinMonths(schedule, 360);
    const closedInterest = interestWithinHorizonClosedForm(200_000, 0.06, 360, 360);
    // Allow $5 tolerance due to rounding differences between row-by-row
    // (which rounds each row to cents) and closed-form (single formula)
    expect(Math.abs(closedInterest - scheduleInterest)).toBeLessThan(5);
  });

  it("matches schedule-based interest for partial horizon", () => {
    const schedule = amortizationSchedule(300_000, 0.065, 360);
    const scheduleInterest = totalInterestWithinMonths(schedule, 240);
    const closedInterest = interestWithinHorizonClosedForm(300_000, 0.065, 360, 240);
    expect(closedInterest).toBeCloseTo(scheduleInterest, 0);
  });
});
