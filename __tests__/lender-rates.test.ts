// ============================================================
// Phase 2 — Lender Rate Scoring Tests
// ============================================================

import { describe, it, expect } from "vitest";
import {
  generateSyntheticRates,
  scoreLenderRate,
  sortScoredRates,
} from "../lib/lender-rates";
import type { LenderRate, ScoredLenderRate } from "../lib/types";

// ================================================================
// Synthetic Rate Generator
// ================================================================

describe("generateSyntheticRates", () => {
  it("returns 6 lender rates", () => {
    const rates = generateSyntheticRates(6.5, 5.8, "excellent", 300_000);
    expect(rates).toHaveLength(6);
  });

  it("each rate has all required fields", () => {
    const rates = generateSyntheticRates(6.5, 5.8, "excellent", 300_000);
    for (const r of rates) {
      expect(r.id).toBeTruthy();
      expect(r.lenderName).toBeTruthy();
      expect(r.rate).toBeGreaterThan(0);
      expect(r.apr).toBeGreaterThan(0);
      expect(r.monthlyPayment).toBeGreaterThan(0);
      expect(r.fees).toBeGreaterThanOrEqual(0);
      expect(r.points).toBeGreaterThanOrEqual(0);
      expect(r.loanProgram).toBeTruthy();
      expect(r.lastUpdated).toBeTruthy();
    }
  });

  it("rates are within realistic range of PMMS base", () => {
    const pmms30 = 6.5; // 6.50%
    const rates = generateSyntheticRates(pmms30, 5.8, "excellent", 300_000);
    for (const r of rates) {
      // Rate should be within ±1% of PMMS base (decimal)
      expect(r.rate).toBeGreaterThan(pmms30 / 100 - 0.01);
      expect(r.rate).toBeLessThan(pmms30 / 100 + 0.01);
    }
  });

  it("fair credit tier increases rates vs excellent", () => {
    const excellent = generateSyntheticRates(6.5, 5.8, "excellent", 300_000);
    const fair = generateSyntheticRates(6.5, 5.8, "fair", 300_000);
    // Each fair rate should be higher than the corresponding excellent rate
    for (let i = 0; i < excellent.length; i++) {
      expect(fair[i]!.rate).toBeGreaterThan(excellent[i]!.rate);
    }
  });

  it("fees scale with balance", () => {
    const small = generateSyntheticRates(6.5, 5.8, "excellent", 100_000);
    const large = generateSyntheticRates(6.5, 5.8, "excellent", 500_000);
    for (let i = 0; i < small.length; i++) {
      expect(large[i]!.fees).toBeGreaterThan(small[i]!.fees);
    }
  });

  it("APR is a positive number for all lenders", () => {
    const rates = generateSyntheticRates(6.5, 5.8, "excellent", 300_000);
    for (const r of rates) {
      expect(r.apr).toBeGreaterThan(0);
      // APR should be in a reasonable range (1%–15%)
      expect(r.apr).toBeGreaterThan(0.01);
      expect(r.apr).toBeLessThan(0.15);
    }
  });
});

// ================================================================
// Score Lender Rate
// ================================================================

describe("scoreLenderRate", () => {
  // A lender offering a much lower rate than the user's current rate
  it("produces green verdict for a large rate drop", () => {
    const lender: LenderRate = {
      id: "test-1",
      lenderName: "Test Lender",
      rate: 0.0575, // 5.75%
      apr: 0.059,
      monthlyPayment: 1750,
      fees: 6000,
      points: 0,
      loanProgram: "30yr Fixed",
      lastUpdated: new Date().toISOString(),
    };

    const scored = scoreLenderRate(
      lender,
      300_000, // balance
      0.075,   // current rate 7.5%
      25,      // years remaining
      6000     // closing costs
    );

    expect(scored.verdict.color).toBe("green");
    // Best scenario may be 15yr (higher payment but more savings overall)
    // so monthlySavings could be negative if best option has higher monthly
    expect(scored.totalSavings).toBeGreaterThan(0);
    expect(scored.breakEvenMonths).not.toBeNull();
    expect(scored.engineOutput).toBeTruthy();
  });

  // A lender rate very close to current rate — should NOT be green
  it("produces red/yellow verdict for tiny rate difference", () => {
    const lender: LenderRate = {
      id: "test-2",
      lenderName: "Marginal Lender",
      rate: 0.074, // 7.4% vs user's 7.5%
      apr: 0.076,
      monthlyPayment: 2100,
      fees: 5000,
      points: 0,
      loanProgram: "30yr Fixed",
      lastUpdated: new Date().toISOString(),
    };

    const scored = scoreLenderRate(
      lender,
      300_000,
      0.075,
      25,
      5000
    );

    // Should NOT be green — rate drop too small relative to fees
    expect(["yellow", "red"]).toContain(scored.verdict.color);
  });

  // A lender rate HIGHER than current rate
  it("produces red verdict when lender rate >= current rate", () => {
    const lender: LenderRate = {
      id: "test-3",
      lenderName: "Expensive Lender",
      rate: 0.08, // 8.0% vs user's 7.5%
      apr: 0.082,
      monthlyPayment: 2300,
      fees: 4000,
      points: 0,
      loanProgram: "30yr Fixed",
      lastUpdated: new Date().toISOString(),
    };

    const scored = scoreLenderRate(
      lender,
      300_000,
      0.075,
      25,
      4000
    );

    expect(scored.verdict.color).toBe("red");
  });

  it("uses lender fees instead of user closing costs when lender fees > 0", () => {
    const lender: LenderRate = {
      id: "test-4",
      lenderName: "High Fee Lender",
      rate: 0.06,
      apr: 0.065,
      monthlyPayment: 1800,
      fees: 15000, // very high fees
      points: 1,
      loanProgram: "30yr Fixed",
      lastUpdated: new Date().toISOString(),
    };

    const scored = scoreLenderRate(
      lender,
      300_000,
      0.075,
      25,
      3000 // user's closing costs are low, but lender fees should be used
    );

    // The scored result should use the lender's fees (15000), not user's (3000)
    expect(scored.fees).toBe(15000);
  });

  it("preserves lender identity fields in scored output", () => {
    const lender: LenderRate = {
      id: "test-5",
      lenderName: "Identity Test",
      rate: 0.06,
      apr: 0.062,
      monthlyPayment: 1800,
      fees: 5000,
      points: 0.5,
      loanProgram: "15yr Fixed",
      lastUpdated: "2025-01-01T00:00:00Z",
    };

    const scored = scoreLenderRate(lender, 300_000, 0.075, 25, 5000);

    expect(scored.id).toBe("test-5");
    expect(scored.lenderName).toBe("Identity Test");
    expect(scored.rate).toBe(0.06);
    expect(scored.points).toBe(0.5);
    expect(scored.loanProgram).toBe("15yr Fixed");
  });
});

// ================================================================
// Sort Scored Rates
// ================================================================

describe("sortScoredRates", () => {
  // Helper to make a minimal ScoredLenderRate
  function makeScoredRate(
    color: "green" | "yellow" | "red",
    totalSavings: number,
    name: string
  ): ScoredLenderRate {
    return {
      id: name,
      lenderName: name,
      rate: 0.06,
      apr: 0.062,
      monthlyPayment: 1800,
      fees: 5000,
      points: 0,
      loanProgram: "30yr Fixed",
      lastUpdated: "",
      verdict: {
        color,
        label: "",
        message: "",
        breakEvenMonths: 12,
        monthlyDelta: -100,
        netSavings: totalSavings,
        bestScenarioId: "refi_same",
        isShortCircuit: false,
      },
      monthlySavings: 100,
      breakEvenMonths: 12,
      totalSavings,
      engineOutput: {
        scenarios: [],
        verdict: {
          color,
          label: "",
          message: "",
          breakEvenMonths: 12,
          monthlyDelta: -100,
          netSavings: totalSavings,
          bestScenarioId: "refi_same",
          isShortCircuit: false,
        },
        horizonMonths: 300,
      },
    };
  }

  it("sorts green before yellow before red", () => {
    const rates = [
      makeScoredRate("red", 100, "Red Lender"),
      makeScoredRate("green", 5000, "Green Lender"),
      makeScoredRate("yellow", 1500, "Yellow Lender"),
    ];

    const sorted = sortScoredRates(rates);

    expect(sorted[0]!.verdict.color).toBe("green");
    expect(sorted[1]!.verdict.color).toBe("yellow");
    expect(sorted[2]!.verdict.color).toBe("red");
  });

  it("within same color, sorts by total savings descending", () => {
    const rates = [
      makeScoredRate("green", 3000, "Green Low"),
      makeScoredRate("green", 8000, "Green High"),
      makeScoredRate("green", 5000, "Green Mid"),
    ];

    const sorted = sortScoredRates(rates);

    expect(sorted[0]!.lenderName).toBe("Green High");
    expect(sorted[1]!.lenderName).toBe("Green Mid");
    expect(sorted[2]!.lenderName).toBe("Green Low");
  });

  it("handles empty array", () => {
    expect(sortScoredRates([])).toEqual([]);
  });

  it("handles single item", () => {
    const rates = [makeScoredRate("yellow", 1000, "Solo")];
    const sorted = sortScoredRates(rates);
    expect(sorted).toHaveLength(1);
    expect(sorted[0]!.lenderName).toBe("Solo");
  });

  it("mixed colors and savings are sorted correctly", () => {
    const rates = [
      makeScoredRate("red", 500, "R1"),
      makeScoredRate("green", 2000, "G1"),
      makeScoredRate("yellow", 3000, "Y1"),
      makeScoredRate("green", 7000, "G2"),
      makeScoredRate("red", -1000, "R2"),
      makeScoredRate("yellow", 1000, "Y2"),
    ];

    const sorted = sortScoredRates(rates);

    // Green first (G2 > G1 by savings)
    expect(sorted[0]!.lenderName).toBe("G2");
    expect(sorted[1]!.lenderName).toBe("G1");
    // Then yellow (Y1 > Y2 by savings)
    expect(sorted[2]!.lenderName).toBe("Y1");
    expect(sorted[3]!.lenderName).toBe("Y2");
    // Then red (R1 > R2 by savings)
    expect(sorted[4]!.lenderName).toBe("R1");
    expect(sorted[5]!.lenderName).toBe("R2");
  });
});
