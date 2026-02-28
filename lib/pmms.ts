// ============================================================
// Shared PMMS (Freddie Mac) rate fetching + in-memory caching
// Used by: /api/market-rates, /api/lender-rates, scripts/fetch_rates.ts
// ============================================================

import type { RateData, RateSource } from "./types";

const PMMS_URL = "https://www.freddiemac.com/pmms";

// ---- In-memory cache ----
interface CacheEntry {
  data: RateData;
  fetchedAt: number; // Date.now()
}

let rateCache: CacheEntry | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// ---- Public API ----

/**
 * Fetch current PMMS rates from Freddie Mac website.
 * Pure function — no file I/O, no caching, no fallback.
 * Throws on failure (network error, parse error, validation error).
 */
export async function fetchPMMSRates(): Promise<RateData> {
  const res = await fetch(PMMS_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; RefinanceClarityEngine/1.0)",
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching PMMS`);
  }

  const html = await res.text();

  // Extract rates — pattern matches "6.85" near "30-Year" / "15-Year"
  const rate30Match = html.match(/30-Year[^%]*?(\d+\.\d+)%/i);
  const rate15Match = html.match(/15-Year[^%]*?(\d+\.\d+)%/i);

  if (!rate30Match || !rate15Match) {
    throw new Error(
      "Could not parse PMMS rates — HTML structure may have changed"
    );
  }

  const fixed_30yr = parseFloat(rate30Match[1]!);
  const fixed_15yr = parseFloat(rate15Match[1]!);

  if (isNaN(fixed_30yr) || isNaN(fixed_15yr)) {
    throw new Error(
      `Parsed NaN rates: 30yr=${rate30Match[1]}, 15yr=${rate15Match[1]}`
    );
  }

  // Sanity range checks
  if (fixed_30yr < 2 || fixed_30yr > 15) {
    throw new Error(
      `30yr rate ${fixed_30yr}% outside expected range [2%, 15%]`
    );
  }
  if (fixed_15yr < 2 || fixed_15yr > 15) {
    throw new Error(
      `15yr rate ${fixed_15yr}% outside expected range [2%, 15%]`
    );
  }

  return {
    source: "freddie_mac_pmms",
    fetched_at: new Date().toISOString(),
    rates: { fixed_30yr, fixed_15yr },
  };
}

/**
 * Check whether a rate change is within acceptable bounds.
 * Returns { valid: false, reason } if change is anomalous (>maxChangePts).
 */
export function validateRateChange(
  fresh: RateData,
  existing: RateData,
  maxChangePts: number = 3
): { valid: boolean; reason?: string } {
  const change30 = Math.abs(
    fresh.rates.fixed_30yr - existing.rates.fixed_30yr
  );
  const change15 = Math.abs(
    fresh.rates.fixed_15yr - existing.rates.fixed_15yr
  );

  if (change30 > maxChangePts || change15 > maxChangePts) {
    return {
      valid: false,
      reason: `Rate change exceeds ${maxChangePts}pts. Old: ${existing.rates.fixed_30yr}%/${existing.rates.fixed_15yr}%, New: ${fresh.rates.fixed_30yr}%/${fresh.rates.fixed_15yr}%`,
    };
  }

  return { valid: true };
}

/**
 * Compute a human-readable age description from a fetched_at timestamp.
 */
export function ageDescription(fetchedAt: string): string {
  const ageMs = Date.now() - new Date(fetchedAt).getTime();
  const hours = Math.floor(ageMs / (1000 * 60 * 60));

  if (hours < 1) return "Updated less than 1 hour ago";
  if (hours < 24)
    return `Updated ${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `Updated ${days} day${days > 1 ? "s" : ""} ago`;
}

/**
 * Get latest PMMS rates with caching and graceful fallback.
 *
 * 1. Returns cached rates if within TTL (6 hours)
 * 2. Tries live fetch from Freddie Mac
 * 3. Validates against fallback (anomaly detection)
 * 4. Falls back to provided static rates on any failure
 *
 * Never throws — always returns usable rate data.
 */
export async function getLatestRates(
  fallback: RateData
): Promise<{ rates: RateData; source: RateSource }> {
  // 1. Check cache
  if (rateCache && Date.now() - rateCache.fetchedAt < CACHE_TTL_MS) {
    return { rates: rateCache.data, source: "cached" };
  }

  // 2. Try live fetch
  try {
    const fresh = await fetchPMMSRates();

    // 3. Anomaly check
    const check = validateRateChange(fresh, fallback);
    if (!check.valid) {
      console.warn(`PMMS anomaly detected: ${check.reason}. Using fallback.`);
      return { rates: fallback, source: "fallback" };
    }

    // Update cache
    rateCache = { data: fresh, fetchedAt: Date.now() };
    return { rates: fresh, source: "live" };
  } catch (err) {
    // 4. Fallback
    console.error(
      "Live PMMS fetch failed, using fallback:",
      (err as Error).message
    );
    return { rates: fallback, source: "fallback" };
  }
}

/**
 * Clear the in-memory cache. Useful for testing.
 */
export function clearRateCache(): void {
  rateCache = null;
}
