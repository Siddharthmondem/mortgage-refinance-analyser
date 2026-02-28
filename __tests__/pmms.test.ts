import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateRateChange,
  ageDescription,
  getLatestRates,
  clearRateCache,
} from "../lib/pmms";
import type { RateData } from "../lib/types";

// ── Helpers ──

function makeRateData(r30: number, r15: number, fetchedAt?: string): RateData {
  return {
    source: "freddie_mac_pmms",
    fetched_at: fetchedAt ?? new Date().toISOString(),
    rates: { fixed_30yr: r30, fixed_15yr: r15 },
  };
}

// ── validateRateChange ──

describe("validateRateChange", () => {
  it("accepts changes within threshold", () => {
    const fresh = makeRateData(6.0, 5.5);
    const existing = makeRateData(5.98, 5.44);
    const result = validateRateChange(fresh, existing);
    expect(result.valid).toBe(true);
  });

  it("rejects 30yr change exceeding threshold", () => {
    const fresh = makeRateData(10.0, 5.5);
    const existing = makeRateData(6.0, 5.5);
    const result = validateRateChange(fresh, existing);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("exceeds");
  });

  it("rejects 15yr change exceeding threshold", () => {
    const fresh = makeRateData(6.0, 10.0);
    const existing = makeRateData(6.0, 5.5);
    const result = validateRateChange(fresh, existing);
    expect(result.valid).toBe(false);
  });

  it("accepts exactly at threshold boundary", () => {
    const fresh = makeRateData(9.0, 5.5);
    const existing = makeRateData(6.0, 5.5);
    // Difference is exactly 3 — should pass (>3 fails)
    const result = validateRateChange(fresh, existing);
    expect(result.valid).toBe(true);
  });

  it("respects custom maxChangePts", () => {
    const fresh = makeRateData(7.0, 5.5);
    const existing = makeRateData(6.0, 5.5);
    // Difference is 1.0 — with maxChangePts=0.5 should fail
    const result = validateRateChange(fresh, existing, 0.5);
    expect(result.valid).toBe(false);
  });
});

// ── ageDescription ──

describe("ageDescription", () => {
  it("returns 'less than 1 hour' for recent timestamps", () => {
    const now = new Date().toISOString();
    expect(ageDescription(now)).toBe("Updated less than 1 hour ago");
  });

  it("returns hours for timestamps within a day", () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    expect(ageDescription(fiveHoursAgo)).toBe("Updated 5 hours ago");
  });

  it("returns singular hour", () => {
    const oneHourAgo = new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString();
    expect(ageDescription(oneHourAgo)).toBe("Updated 1 hour ago");
  });

  it("returns days for timestamps beyond 24 hours", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(ageDescription(threeDaysAgo)).toBe("Updated 3 days ago");
  });

  it("returns singular day", () => {
    const oneDayAgo = new Date(Date.now() - 1.1 * 24 * 60 * 60 * 1000).toISOString();
    expect(ageDescription(oneDayAgo)).toBe("Updated 1 day ago");
  });
});

// ── getLatestRates ──

describe("getLatestRates", () => {
  const fallback = makeRateData(5.98, 5.44, "2026-02-26T00:00:00Z");

  beforeEach(() => {
    clearRateCache();
    vi.restoreAllMocks();
  });

  it("falls back when fetch throws a network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network down"));

    const result = await getLatestRates(fallback);
    expect(result.source).toBe("fallback");
    expect(result.rates.rates.fixed_30yr).toBe(5.98);
    expect(result.rates.rates.fixed_15yr).toBe(5.44);
  });

  it("falls back when fetch returns non-OK response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Server Error", { status: 500 })
    );

    const result = await getLatestRates(fallback);
    expect(result.source).toBe("fallback");
  });

  it("falls back when HTML cannot be parsed", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("<html><body>No rate data here</body></html>", { status: 200 })
    );

    const result = await getLatestRates(fallback);
    expect(result.source).toBe("fallback");
  });

  it("returns live rates when fetch succeeds with valid data", async () => {
    const html = `
      <div>30-Year Fixed Rate: 6.10%</div>
      <div>15-Year Fixed Rate: 5.50%</div>
    `;
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(html, { status: 200 })
    );

    const result = await getLatestRates(fallback);
    expect(result.source).toBe("live");
    expect(result.rates.rates.fixed_30yr).toBe(6.10);
    expect(result.rates.rates.fixed_15yr).toBe(5.50);
  });

  it("returns cached rates on second call within TTL", async () => {
    // First call: live fetch
    const html = `
      <div>30-Year Fixed Rate: 6.10%</div>
      <div>15-Year Fixed Rate: 5.50%</div>
    `;
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(html, { status: 200 })
    );

    const first = await getLatestRates(fallback);
    expect(first.source).toBe("live");

    // Second call: should use cache (no fetch)
    const second = await getLatestRates(fallback);
    expect(second.source).toBe("cached");
    expect(second.rates.rates.fixed_30yr).toBe(6.10);
  });

  it("rejects anomalous rate changes and falls back", async () => {
    // Anomalous: 30yr jumped from 5.98 to 12.00 (>3pt change)
    const html = `
      <div>30-Year Fixed Rate: 12.00%</div>
      <div>15-Year Fixed Rate: 5.50%</div>
    `;
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(html, { status: 200 })
    );

    const result = await getLatestRates(fallback);
    expect(result.source).toBe("fallback");
    expect(result.rates.rates.fixed_30yr).toBe(5.98); // original fallback
  });

  it("rejects rates outside valid range (too low)", async () => {
    const html = `
      <div>30-Year Fixed Rate: 0.50%</div>
      <div>15-Year Fixed Rate: 5.50%</div>
    `;
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(html, { status: 200 })
    );

    const result = await getLatestRates(fallback);
    // fetchPMMSRates should throw (0.50 < 2), triggering fallback
    expect(result.source).toBe("fallback");
  });
});
