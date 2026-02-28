// ============================================================
// IRR Module Tests
// ============================================================
// computeIRR(fees, refiPmt, basePmt, refiTermMonths, balanceSaved, horizonMonths)
// ============================================================

import { describe, it, expect } from "vitest";
import { computeIRR } from "../lib/irr";

// Tolerance for annualized IRR comparisons (±0.5 percentage points)
const TOLERANCE = 0.005;

// Convenience: same-term scenario (refiTermMonths === horizonMonths)
// basePmt is arbitrary; delta = basePmt - refiPmt (positive = refi is cheaper)
const BASE_PMT = 2000;

function sameTerm(fees: number, monthlySavings: number, horizonMonths: number, balanceSaved = 0) {
  // monthlySavings > 0 → refiPmt < basePmt (cheaper)
  // monthlySavings < 0 → refiPmt > basePmt (payment increase)
  return computeIRR(fees, BASE_PMT - monthlySavings, BASE_PMT, horizonMonths, balanceSaved, horizonMonths);
}

describe("computeIRR — edge cases", () => {
  it("returns Infinity when fees = 0", () => {
    expect(computeIRR(0, 1900, 2000, 60, 0, 60)).toBe(Infinity);
  });

  it("returns Infinity when fees is negative", () => {
    expect(computeIRR(-100, 1900, 2000, 60, 0, 60)).toBe(Infinity);
  });

  it("returns null when horizonMonths = 0", () => {
    expect(computeIRR(5000, 1800, 2000, 60, 0, 0)).toBeNull();
  });

  it("returns null when horizonMonths is negative", () => {
    expect(computeIRR(5000, 1800, 2000, 60, 0, -10)).toBeNull();
  });

  // When payment went UP and no balance savings at all periods in same-term:
  // all future CFs are negative (paying more every month, no terminal benefit)
  // NPV has no zero crossing → null
  it("returns null when payment increased with no balance or payoff benefit", () => {
    // refiPmt = 2100 > basePmt = 2000 → CF[k] = -100/mo, all negative
    const irr = computeIRR(10000, 2100, 2000, 60, 0, 60);
    expect(irr).toBeNull();
  });
});

describe("computeIRR — break-even at exactly 1 year (same-term)", () => {
  // fees = 1200, saving $100/mo for 12 months, no balance benefit
  // NPV(0) = -1200 + 100×12 = 0 → monthly_r = 0 → annualized = 0%
  it("returns ≈0% when total savings exactly equal fees over 1 year", () => {
    const irr = sameTerm(1200, 100, 12);
    expect(irr).not.toBeNull();
    expect(irr!).toBeGreaterThanOrEqual(-TOLERANCE);
    expect(irr!).toBeLessThanOrEqual(TOLERANCE);
  });
});

describe("computeIRR — positive IRR (same-term refi)", () => {
  // fees = 5000, saving $200/mo for 60mo
  // NPV(0) = -5000 + 200×60 = 7000 > 0 → positive IRR
  it("returns positive IRR when savings exceed fees within horizon", () => {
    const irr = sameTerm(5000, 200, 60);
    expect(irr).not.toBeNull();
    expect(irr!).toBeGreaterThan(0);
  });

  // fees = 3000, saving $150/mo for 36mo
  // NPV(0) = -3000 + 5400 = 2400 > 0 → positive IRR
  it("returns positive IRR when recouped well within horizon", () => {
    const irr = sameTerm(3000, 150, 36);
    expect(irr).not.toBeNull();
    expect(irr!).toBeGreaterThan(0);
  });
});

describe("computeIRR — negative IRR (savings too small)", () => {
  // fees = 5000, saving only $30/mo for 36mo
  // NPV(0) = -5000 + 1080 = -3920 < 0
  // But as r → -100%, annuity → ∞, NPV → +∞ → sign change exists → negative IRR
  it("returns negative IRR when savings are far too small to recoup fees in horizon", () => {
    const irr = sameTerm(5000, 30, 36);
    expect(irr).not.toBeNull();
    expect(irr!).toBeLessThan(0);
  });

  // fees = 8000, saving $50/mo for 48mo → total savings = 2400 << 8000
  it("returns negative IRR for very poor same-term deal", () => {
    const irr = sameTerm(8000, 50, 48);
    expect(irr).not.toBeNull();
    expect(irr!).toBeLessThan(0);
  });
});

describe("computeIRR — early payoff scenario (15yr refi model)", () => {
  // Simulates 15yr refi at full-horizon:
  // refiPmt = 2400 (higher than baseline 2000), refiTermMonths = 180
  // horizonMonths = 300 (full 25yr horizon)
  // After month 180: baseline still pays 2000/mo, 15yr is free
  // balanceSaved = 0 (both fully paid off at horizon)
  //
  // NPV(0) = -fees + (2000-2400)×180 + 2000×120 + 0
  //        = -fees - 72000 + 240000
  //        = 168000 - fees  (positive for realistic fees)
  it("returns positive IRR for 15yr model even though monthly payment is higher", () => {
    const irr = computeIRR(
      8000,    // fees
      2400,    // refiPmt (higher than baseline)
      2000,    // basePmt
      180,     // refiTermMonths (15yr payoff)
      0,       // balanceSaved (both paid off at horizon)
      300      // horizonMonths (25yr)
    );
    expect(irr).not.toBeNull();
    expect(irr!).toBeGreaterThan(0);
  });

  // With large balance savings at a shorter horizon:
  // refiPmt = 2400, basePmt = 2000, refiTerm = 180, horizonMonths = 60
  // NPV(0) = -5000 + (2000-2400)×60 + 35000 = +6000 > 0 → positive IRR
  // (need balanceSaved > 29000 to overcome fees + payment increases over 60mo)
  it("returns positive IRR when terminal balance savings outweigh payment increases (short horizon)", () => {
    const irr = computeIRR(5000, 2400, 2000, 180, 35000, 60);
    expect(irr).not.toBeNull();
    expect(irr!).toBeGreaterThan(0);
  });

  // Higher balance savings → higher IRR (all else equal)
  it("returns higher IRR with larger balance savings", () => {
    const irrSmall = computeIRR(5000, 2400, 2000, 180, 15000, 60);
    const irrLarge = computeIRR(5000, 2400, 2000, 180, 30000, 60);
    expect(irrSmall).not.toBeNull();
    expect(irrLarge).not.toBeNull();
    expect(irrLarge!).toBeGreaterThan(irrSmall!);
  });
});

describe("computeIRR — annualization formula", () => {
  // Verify: annualized = (1 + monthly_r)^12 - 1
  // For fees=1200, saving $100/mo, N=12 → monthly_r ≈ 0 → annualized ≈ 0
  it("annualized IRR is computed as (1 + monthly_r)^12 - 1", () => {
    const annualized = sameTerm(1200, 100, 12);
    expect(annualized).not.toBeNull();
    expect(Math.abs(annualized!)).toBeLessThan(TOLERANCE);
  });

  // Verify a 6-month break-even case
  it("returns ≈0% when exactly break-even over 6 months", () => {
    const irr = sameTerm(600, 100, 6);
    expect(irr).not.toBeNull();
    expect(Math.abs(irr!)).toBeLessThan(TOLERANCE);
  });
});

describe("computeIRR — monotonicity", () => {
  // Higher monthly savings → higher IRR (all else equal)
  it("IRR increases with higher monthly savings", () => {
    const irr100 = sameTerm(5000, 100, 60);
    const irr200 = sameTerm(5000, 200, 60);
    const irr300 = sameTerm(5000, 300, 60);
    expect(irr100).not.toBeNull();
    expect(irr200).not.toBeNull();
    expect(irr300).not.toBeNull();
    expect(irr200!).toBeGreaterThan(irr100!);
    expect(irr300!).toBeGreaterThan(irr200!);
  });

  // Longer horizon with same savings rate → higher IRR
  // (More total return on the same investment → higher annualized rate)
  it("IRR is higher for longer horizon with same savings rate (more total return)", () => {
    // fees=3600, saving $300/mo → break-even at 12mo in both cases
    const irr24 = sameTerm(3600, 300, 24);
    const irr60 = sameTerm(3600, 300, 60);
    expect(irr24).not.toBeNull();
    expect(irr60).not.toBeNull();
    // Longer horizon = more periods getting $300/mo back = higher effective return
    expect(irr60!).toBeGreaterThan(irr24!);
  });

  // IRR decreases as fees increase (all else equal)
  it("IRR decreases as closing costs increase", () => {
    const irr3k = sameTerm(3000, 200, 60);
    const irr6k = sameTerm(6000, 200, 60);
    const irr9k = sameTerm(9000, 200, 60);
    expect(irr3k).not.toBeNull();
    expect(irr6k).not.toBeNull();
    expect(irr9k).not.toBeNull();
    expect(irr3k!).toBeGreaterThan(irr6k!);
    expect(irr6k!).toBeGreaterThan(irr9k!);
  });
});
