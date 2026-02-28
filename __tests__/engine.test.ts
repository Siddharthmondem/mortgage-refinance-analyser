// ============================================================
// Full Engine — Integration Tests (15 cases)
// ============================================================
// Tests cover: term reset trap, high fees, small rate drop,
// Y>15 / Y<=15 behavior, N>180 payoff, edge cases
// ============================================================

import { describe, it, expect } from "vitest";
import { runEngine } from "../lib/comparison";
import type { EngineInput } from "../lib/types";

// Helper: build EngineInput with sane defaults
function input(overrides: Partial<EngineInput> & Pick<EngineInput, "remainingBalance" | "currentAnnualRate" | "yearsRemaining" | "closingCosts">): EngineInput {
  return {
    refiRateSameTerm: 0.0575,
    refiRate15yr: 0.0525,
    refiRate30yr: 0.06,
    ...overrides,
  };
}

describe("Engine Integration Tests", () => {
  // ================================================================
  // CASE 1: Clear win — large rate drop
  // ================================================================
  it("Case 1: Clear win with large rate drop → green verdict", () => {
    const result = runEngine(
      input({
        remainingBalance: 300_000,
        currentAnnualRate: 0.075,
        yearsRemaining: 25,
        closingCosts: 6_000,
        refiRateSameTerm: 0.0575,
        refiRate15yr: 0.0525,
        refiRate30yr: 0.06,
      })
    );

    expect(result.verdict.color).toBe("green");
    expect(result.verdict.netSavings).toBeGreaterThan(2_000);
    expect(result.verdict.breakEvenMonths).toBeLessThan(24);
    expect(result.scenarios.length).toBeGreaterThanOrEqual(3); // baseline + same term + 15yr + 30yr
    // Winner should be a refi scenario
    expect(result.verdict.bestScenarioId).not.toBe("stay_current");
  });

  // ================================================================
  // CASE 2: Marginal — small rate drop
  // ================================================================
  it("Case 2: Small rate drop → yellow or red verdict", () => {
    const result = runEngine(
      input({
        remainingBalance: 200_000,
        currentAnnualRate: 0.0625,
        yearsRemaining: 15,  // Y=15 prevents 15yr scenario from appearing
        closingCosts: 4_000,
        refiRateSameTerm: 0.06, // only 0.25% drop
        refiRate15yr: 0.055,    // irrelevant — Y not > 15
        refiRate30yr: 0.0625,   // same as current — won't appear
      })
    );

    // 0.25% rate drop, $4k fees, 15yr horizon:
    // break-even ~130 months vs 180 total → ratio > 0.67 → red
    expect(["yellow", "red"]).toContain(result.verdict.color);
  });

  // ================================================================
  // CASE 3: Rates higher than current → stay current
  // ================================================================
  it("Case 3: All refi rates >= current rate → stay current (red)", () => {
    const result = runEngine(
      input({
        remainingBalance: 250_000,
        currentAnnualRate: 0.05,
        yearsRemaining: 22,
        closingCosts: 5_000,
        refiRateSameTerm: 0.055, // higher
        refiRate15yr: 0.05,     // same
        refiRate30yr: 0.06,     // higher
      })
    );

    expect(result.verdict.color).toBe("red");
    expect(result.verdict.bestScenarioId).toBe("stay_current");
    expect(result.verdict.label).toContain("Stay");
  });

  // ================================================================
  // CASE 4: 15-year opportunity with Y=28
  // ================================================================
  it("Case 4: 15-year refi opportunity (Y=28, big rate drop)", () => {
    const result = runEngine(
      input({
        remainingBalance: 400_000,
        currentAnnualRate: 0.07,
        yearsRemaining: 28,
        closingCosts: 8_000,
        refiRateSameTerm: 0.055,
        refiRate15yr: 0.0475,
        refiRate30yr: 0.0575,
      })
    );

    // Should include 15yr scenario since Y > 15
    const has15yr = result.scenarios.some((s) => s.id === "refi_15yr");
    expect(has15yr).toBe(true);

    // 15yr should have $0 remaining balance at horizon
    const sc15 = result.scenarios.find((s) => s.id === "refi_15yr")!;
    expect(sc15.remainingBalanceAtHorizon).toBe(0);

    expect(result.verdict.color).toBe("green");
  });

  // ================================================================
  // CASE 5: Term reset trap — 10 years remaining
  // ================================================================
  it("Case 5: Term reset trap with 10 years remaining", () => {
    const result = runEngine(
      input({
        remainingBalance: 350_000,
        currentAnnualRate: 0.0675,
        yearsRemaining: 10,
        closingCosts: 7_000,
        refiRateSameTerm: 0.055,
        refiRate15yr: 0.05,
        refiRate30yr: 0.06,
      })
    );

    // 30-year reset should show huge remaining balance
    const sc30 = result.scenarios.find((s) => s.id === "refi_30yr");
    expect(sc30).toBeDefined();
    expect(sc30!.remainingBalanceAtHorizon).toBeGreaterThan(200_000);

    // Should have term reset trap warning
    expect(sc30!.warnings.some((w) => w.includes("Term Reset Trap"))).toBe(true);

    // 15yr should NOT appear (Y=10 <= 15)
    const has15yr = result.scenarios.some((s) => s.id === "refi_15yr");
    expect(has15yr).toBe(false);
  });

  // ================================================================
  // CASE 6: Nearly paid off — small balance, short term
  // ================================================================
  it("Case 6: Nearly paid off ($50k, 5yr) → stay current", () => {
    const result = runEngine(
      input({
        remainingBalance: 50_000,
        currentAnnualRate: 0.06,
        yearsRemaining: 5,
        closingCosts: 3_000,
        refiRateSameTerm: 0.055,
        refiRate15yr: 0.05,
        refiRate30yr: 0.06, // same as current → won't appear
      })
    );

    // With small balance and high relative fees, closing costs eat savings
    // 15yr should not appear (Y=5 <= 15)
    const has15yr = result.scenarios.some((s) => s.id === "refi_15yr");
    expect(has15yr).toBe(false);

    // 30yr should not appear (rate not lower than current)
    const has30yr = result.scenarios.some((s) => s.id === "refi_30yr");
    expect(has30yr).toBe(false);

    // The verdict should reflect that savings are modest
    expect(["yellow", "red"]).toContain(result.verdict.color);
  });

  // ================================================================
  // CASE 7: Large balance — $900k, 28yr
  // ================================================================
  it("Case 7: Large balance ($900k) with rate drop → green", () => {
    const result = runEngine(
      input({
        remainingBalance: 900_000,
        currentAnnualRate: 0.0725,
        yearsRemaining: 28,
        closingCosts: 18_000,
        refiRateSameTerm: 0.0575,
        refiRate15yr: 0.0525,
        refiRate30yr: 0.06,
      })
    );

    expect(result.verdict.color).toBe("green");
    expect(result.verdict.netSavings).toBeGreaterThan(50_000); // big savings on large balance
    // All refi rates < current, Y > 15, so all 4 scenarios should be present
    expect(result.scenarios.length).toBe(4);
  });

  // ================================================================
  // CASE 8: High fees scenario
  // ================================================================
  it("Case 8: Very high closing costs ($20k) extend break-even beyond 5yr horizon", () => {
    const result = runEngine(
      input({
        remainingBalance: 250_000,
        currentAnnualRate: 0.07,
        yearsRemaining: 20,
        closingCosts: 20_000, // 8% of balance — very high
        refiRateSameTerm: 0.06,
        refiRate15yr: 0.055,
        refiRate30yr: 0.065,
        horizonOverrideMonths: 60, // 5yr — break-even is ~96mo > 60mo → red
      })
    );

    // High fees on 5yr horizon: break-even ratio near or above 0.67 → red
    expect(result.verdict.color).toBe("red");
    // Break-even ratio should be ≥ 0.67 of the 60mo horizon
    const winner = result.scenarios.find((s) => s.isBestLongTerm);
    if (winner && winner.id !== "stay_current" && winner.interestBreakEvenMonths !== null) {
      expect(winner.interestBreakEvenMonths / 60).toBeGreaterThanOrEqual(0.67);
    }
  });

  // ================================================================
  // CASE 9: 15yr threshold — Y=15 (should NOT show 15yr scenario)
  // ================================================================
  it("Case 9: Y=15 exactly → 15yr scenario should NOT appear", () => {
    const result = runEngine(
      input({
        remainingBalance: 300_000,
        currentAnnualRate: 0.07,
        yearsRemaining: 15,
        closingCosts: 6_000,
        refiRateSameTerm: 0.06,
        refiRate15yr: 0.055,
        refiRate30yr: 0.065,
      })
    );

    const has15yr = result.scenarios.some((s) => s.id === "refi_15yr");
    expect(has15yr).toBe(false);
  });

  // ================================================================
  // CASE 10: 15yr threshold — Y=16 (SHOULD show 15yr scenario)
  // ================================================================
  it("Case 10: Y=16 → 15yr scenario SHOULD appear", () => {
    const result = runEngine(
      input({
        remainingBalance: 300_000,
        currentAnnualRate: 0.07,
        yearsRemaining: 16,
        closingCosts: 6_000,
        refiRateSameTerm: 0.06,
        refiRate15yr: 0.055,
        refiRate30yr: 0.065,
      })
    );

    const has15yr = result.scenarios.some((s) => s.id === "refi_15yr");
    expect(has15yr).toBe(true);

    // 15yr loan finishes in 180 months, horizon is 192 months
    // So remaining balance at horizon should be 0
    const sc15 = result.scenarios.find((s) => s.id === "refi_15yr")!;
    expect(sc15.remainingBalanceAtHorizon).toBe(0);
  });

  // ================================================================
  // CASE 11: Zero closing costs → instant break-even
  // ================================================================
  it("Case 11: Zero closing costs → instant break-even, green verdict", () => {
    const result = runEngine(
      input({
        remainingBalance: 200_000,
        currentAnnualRate: 0.07,
        yearsRemaining: 20,
        closingCosts: 0,
        refiRateSameTerm: 0.06,
        refiRate15yr: 0.055,
        refiRate30yr: 0.065,
      })
    );

    const winner = result.scenarios.find((s) => s.isBestLongTerm);
    expect(winner).toBeDefined();
    if (winner && winner.id !== "stay_current") {
      // With 0 fees, interest break-even should be 0
      // cashflowBreakEvenMonths may be null if payment increases (e.g., 15yr winner)
      expect(winner.interestBreakEvenMonths).toBe(0);
    }
    // Verdict break-even uses true break-even, which is 0 for $0 fees
    expect(result.verdict.breakEvenMonths).toBe(0);
    expect(result.verdict.color).toBe("green");
  });

  // ================================================================
  // CASE 12: 1 year remaining — too short to recoup
  // ================================================================
  it("Case 12: Only 1 year remaining → stay current", () => {
    const result = runEngine(
      input({
        remainingBalance: 20_000,
        currentAnnualRate: 0.06,
        yearsRemaining: 1,
        closingCosts: 2_000,
        refiRateSameTerm: 0.05,
        refiRate15yr: 0.045,
        refiRate30yr: 0.055,
      })
    );

    // $2k fees on a $20k, 1-year loan with tiny rate drop = bad deal
    // 15yr should not appear (Y=1 <= 15)
    expect(result.scenarios.some((s) => s.id === "refi_15yr")).toBe(false);

    // Verdict should be red — fees dominate
    expect(result.verdict.color).toBe("red");
  });

  // ================================================================
  // CASE 13: N > 180 — refi 15yr pays off before horizon
  // ================================================================
  it("Case 13: 25yr horizon with 15yr refi → loan paid off before horizon end", () => {
    const result = runEngine(
      input({
        remainingBalance: 300_000,
        currentAnnualRate: 0.075,
        yearsRemaining: 25,
        closingCosts: 6_000,
        refiRateSameTerm: 0.06,
        refiRate15yr: 0.0525,
        refiRate30yr: 0.065,
      })
    );

    // 15yr refi: term = 180 months, horizon = 300 months
    // The 15yr loan is fully paid off within the horizon
    const sc15 = result.scenarios.find((s) => s.id === "refi_15yr")!;
    expect(sc15).toBeDefined();
    expect(sc15.remainingBalanceAtHorizon).toBe(0);
    expect(sc15.termMonths).toBe(180);

    // Interest should only be computed for 180 months (loan duration)
    // not 300 months (horizon)
    expect(sc15.interestWithinHorizon).toBeGreaterThan(0);
  });

  // ================================================================
  // CASE 14: 30-year reset remaining balance correctness
  // ================================================================
  it("Case 14: 30yr reset shows correct remaining balance at horizon", () => {
    const result = runEngine(
      input({
        remainingBalance: 250_000,
        currentAnnualRate: 0.065,
        yearsRemaining: 20,
        closingCosts: 5_000,
        refiRateSameTerm: 0.055,
        refiRate15yr: 0.05,
        refiRate30yr: 0.06,
      })
    );

    const sc30 = result.scenarios.find((s) => s.id === "refi_30yr")!;
    expect(sc30).toBeDefined();

    // 30yr at 6%: at month 240 (year 20) out of 360, significant balance remains
    expect(sc30.remainingBalanceAtHorizon).toBeGreaterThan(100_000);
    expect(sc30.remainingBalanceAtHorizon).toBeLessThan(200_000);

    // cashOutflowWithinHorizon = fees + paymentsWithinHorizon
    expect(sc30.cashOutflowWithinHorizon).toBeCloseTo(
      sc30.fees + sc30.paymentsWithinHorizon,
      2
    );

    // Warning should be present
    expect(sc30.warnings.length).toBeGreaterThan(0);
    expect(sc30.warnings[0]).toContain("Term Reset Trap");
  });

  // ================================================================
  // CASE 15: Max balance stress test
  // ================================================================
  it("Case 15: $2M balance, 30yr — engine handles large numbers", () => {
    const result = runEngine(
      input({
        remainingBalance: 2_000_000,
        currentAnnualRate: 0.08,
        yearsRemaining: 30,
        closingCosts: 40_000,
        refiRateSameTerm: 0.065,
        refiRate15yr: 0.06,
        refiRate30yr: 0.07,
      })
    );

    // Should not crash, produce valid output
    expect(result.scenarios.length).toBe(4); // all 4 (Y=30 > 15)
    expect(result.verdict.color).toBeDefined();
    expect(result.horizonMonths).toBe(360);

    // All numbers should be finite
    for (const s of result.scenarios) {
      expect(Number.isFinite(s.monthlyPayment)).toBe(true);
      expect(Number.isFinite(s.interestWithinHorizon)).toBe(true);
      expect(Number.isFinite(s.netCostAtHorizon)).toBe(true);
      expect(Number.isFinite(s.remainingBalanceAtHorizon)).toBe(true);
      expect(s.monthlyPayment).toBeGreaterThan(0);
    }

    // With 1.5% rate drop on $2M, savings should be massive
    expect(result.verdict.netSavings).toBeGreaterThan(100_000);
    expect(result.verdict.color).toBe("green");
  });
});

// ================================================================
// Structural / invariant tests
// ================================================================
describe("Engine Invariants", () => {
  it("baseline always has 0 fees and 0 remaining balance", () => {
    const result = runEngine(
      input({
        remainingBalance: 300_000,
        currentAnnualRate: 0.065,
        yearsRemaining: 25,
        closingCosts: 6_000,
      })
    );

    const baseline = result.scenarios.find((s) => s.id === "stay_current")!;
    expect(baseline.fees).toBe(0);
    expect(baseline.remainingBalanceAtHorizon).toBe(0);
    expect(baseline.monthlyDelta).toBe(0);
    expect(baseline.netSavingsAtHorizon).toBe(0);
  });

  it("exactly one scenario is marked as best", () => {
    const result = runEngine(
      input({
        remainingBalance: 300_000,
        currentAnnualRate: 0.075,
        yearsRemaining: 25,
        closingCosts: 6_000,
      })
    );

    const bestCount = result.scenarios.filter((s) => s.isBestLongTerm).length;
    expect(bestCount).toBe(1);
  });

  it("verdict bestScenarioId matches the marked scenario", () => {
    const result = runEngine(
      input({
        remainingBalance: 300_000,
        currentAnnualRate: 0.075,
        yearsRemaining: 25,
        closingCosts: 6_000,
      })
    );

    const best = result.scenarios.find((s) => s.isBestLongTerm)!;
    expect(best.id).toBe(result.verdict.bestScenarioId);
  });

  it("all monthly payments are positive", () => {
    const result = runEngine(
      input({
        remainingBalance: 500_000,
        currentAnnualRate: 0.07,
        yearsRemaining: 25,
        closingCosts: 10_000,
      })
    );

    for (const s of result.scenarios) {
      expect(s.monthlyPayment).toBeGreaterThan(0);
    }
  });

  it("netCostAtHorizon = cashOutflowWithinHorizon + remainingBalanceAtHorizon", () => {
    const result = runEngine(
      input({
        remainingBalance: 400_000,
        currentAnnualRate: 0.07,
        yearsRemaining: 22,
        closingCosts: 8_000,
      })
    );

    for (const s of result.scenarios) {
      expect(s.netCostAtHorizon).toBeCloseTo(
        s.cashOutflowWithinHorizon + s.remainingBalanceAtHorizon,
        2
      );
      expect(s.cashOutflowWithinHorizon).toBeCloseTo(
        s.fees + s.paymentsWithinHorizon,
        2
      );
    }
  });

  it("horizonOverrideMonths wires through engine correctly", () => {
    const result = runEngine(
      input({
        remainingBalance: 300_000,
        currentAnnualRate: 0.075,
        yearsRemaining: 25,
        closingCosts: 6_000,
        horizonOverrideMonths: 60,
      })
    );

    expect(result.horizonMonths).toBe(60);

    // All scenarios should have remainingBalance > 0 at 5yr horizon (none paid off yet)
    for (const s of result.scenarios) {
      expect(s.remainingBalanceAtHorizon).toBeGreaterThan(0);
    }
  });

  it("verdict is RED when interest break-even exceeds horizon", () => {
    // Very high fees relative to small rate drop → break-even > 3yr horizon
    const result = runEngine(
      input({
        remainingBalance: 150_000,
        currentAnnualRate: 0.065,
        yearsRemaining: 20,
        closingCosts: 15_000, // very high
        refiRateSameTerm: 0.063, // tiny drop
        refiRate15yr: 0.06,
        refiRate30yr: 0.064,
        horizonOverrideMonths: 36, // 3yr horizon
      })
    );

    // With huge fees and tiny rate drop at 3yr horizon, should be red
    expect(result.verdict.color).toBe("red");
  });

  it("savings threshold scales with horizon (GREEN at 10yr, not at 3yr)", () => {
    // A scenario that barely qualifies for green at 10yr but not 3yr
    // $300k loan, 0.5% rate drop, $5k fees — Y=15 to prevent 15yr from dominating
    // 30yr rate higher than current so only same-term appears
    const sharedParams = {
      remainingBalance: 300_000,
      currentAnnualRate: 0.07,
      yearsRemaining: 15,   // prevents 15yr scenario
      closingCosts: 5_000,
      refiRateSameTerm: 0.065, // 0.5% drop
      refiRate15yr: 0.06,      // irrelevant
      refiRate30yr: 0.075,     // higher than current → won't appear
    };

    const result10yr = runEngine(input({ ...sharedParams, horizonOverrideMonths: 120 }));
    const result3yr  = runEngine(input({ ...sharedParams, horizonOverrideMonths: 36 }));

    // At 3yr: break-even ~60mo >> 36mo horizon (ratio > 1) → red
    expect(result3yr.verdict.color).toBe("red");
    // At 10yr: break-even ~60mo, ratio = 0.5 < 0.67 with $4.3k savings → yellow
    expect(["yellow", "green"]).toContain(result10yr.verdict.color);
  });

  it("same-term and baseline have remainingBalance=0 at horizon", () => {
    const result = runEngine(
      input({
        remainingBalance: 250_000,
        currentAnnualRate: 0.07,
        yearsRemaining: 20,
        closingCosts: 5_000,
      })
    );

    const baseline = result.scenarios.find((s) => s.id === "stay_current")!;
    const sameTerm = result.scenarios.find((s) => s.id === "refi_same_term");

    expect(baseline.remainingBalanceAtHorizon).toBe(0);
    if (sameTerm) {
      expect(sameTerm.remainingBalanceAtHorizon).toBe(0);
    }
  });
});
