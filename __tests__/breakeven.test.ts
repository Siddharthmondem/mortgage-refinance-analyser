// ============================================================
// Break-Even — Unit Tests
// ============================================================

import { describe, it, expect } from "vitest";
import { simpleBreakEven, trueBreakEven } from "../lib/breakeven";
import { amortizationSchedule } from "../lib/amortization";

describe("simpleBreakEven", () => {
  it("computes basic break-even", () => {
    // $6,000 closing costs / $200/mo savings = 30 months
    const result = simpleBreakEven(6_000, 2_000, 1_800);
    expect(result).toBe(30);
  });

  it("returns null when refi payment >= baseline", () => {
    const result = simpleBreakEven(6_000, 1_500, 1_800);
    expect(result).toBeNull();
  });

  it("returns 0 when closing costs are 0", () => {
    const result = simpleBreakEven(0, 2_000, 1_800);
    expect(result).toBe(0);
  });

  it("ceils fractional months", () => {
    // $5,000 / $300 = 16.67 → 17
    const result = simpleBreakEven(5_000, 2_000, 1_700);
    expect(result).toBe(17);
  });

  it("returns null when payments are equal", () => {
    const result = simpleBreakEven(5_000, 2_000, 2_000);
    expect(result).toBeNull();
  });
});

describe("trueBreakEven", () => {
  it("finds break-even when rates differ significantly", () => {
    const baseline = amortizationSchedule(300_000, 0.075, 300);
    const refi = amortizationSchedule(300_000, 0.055, 300);
    const result = trueBreakEven(baseline, refi, 6_000, 300);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(0);
    expect(result!).toBeLessThan(30); // should recoup fast with 2% rate drop
  });

  it("returns null when savings never cover costs", () => {
    // Tiny rate difference, high fees
    const baseline = amortizationSchedule(50_000, 0.06, 60);
    const refi = amortizationSchedule(50_000, 0.0595, 60);
    const result = trueBreakEven(baseline, refi, 10_000, 60);
    expect(result).toBeNull();
  });

  it("returns 0 when closing costs are 0", () => {
    const baseline = amortizationSchedule(200_000, 0.07, 240);
    const refi = amortizationSchedule(200_000, 0.06, 240);
    const result = trueBreakEven(baseline, refi, 0, 240);
    expect(result).toBe(0);
  });
});
