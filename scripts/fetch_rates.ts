#!/usr/bin/env node
// ============================================================
// Fetch Freddie Mac PMMS rates and write to data/rates.json
// Run weekly: npx tsx scripts/fetch_rates.ts
// ============================================================

import fs from "fs";
import path from "path";

const OUTPUT_PATH = path.resolve(process.cwd(), "data/rates.json");
const PMMS_URL = "https://www.freddiemac.com/pmms";

interface RateData {
  source: "freddie_mac_pmms";
  fetched_at: string;
  rates: {
    fixed_30yr: number;
    fixed_15yr: number;
  };
}

async function fetchPMMS(): Promise<RateData> {
  console.log("Fetching Freddie Mac PMMS rates...");
  const res = await fetch(PMMS_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; RefinanceClarityEngine/1.0; +https://github.com/your-repo)",
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching PMMS`);
  }

  const html = await res.text();

  // Extract rates from PMMS page HTML
  // Pattern matches: "6.85" near "30-Year" and "6.02" near "15-Year"
  const rate30Match = html.match(/30-Year[^%]*?(\d+\.\d+)%/i);
  const rate15Match = html.match(/15-Year[^%]*?(\d+\.\d+)%/i);

  if (!rate30Match || !rate15Match) {
    throw new Error("Could not parse PMMS rates from page — HTML structure may have changed");
  }

  const fixed_30yr = parseFloat(rate30Match[1]!);
  const fixed_15yr = parseFloat(rate15Match[1]!);

  if (isNaN(fixed_30yr) || isNaN(fixed_15yr)) {
    throw new Error(`Parsed NaN rates: 30yr=${rate30Match[1]}, 15yr=${rate15Match[1]}`);
  }

  // Sanity checks — flag if anomalous
  if (fixed_30yr < 2 || fixed_30yr > 15) {
    throw new Error(`30yr rate ${fixed_30yr}% is outside expected range [2%, 15%]`);
  }
  if (fixed_15yr < 2 || fixed_15yr > 15) {
    throw new Error(`15yr rate ${fixed_15yr}% is outside expected range [2%, 15%]`);
  }
  if (fixed_15yr > fixed_30yr) {
    console.warn(
      `Warning: 15yr rate (${fixed_15yr}%) > 30yr rate (${fixed_30yr}%) — unusual. Verify manually.`
    );
  }

  return {
    source: "freddie_mac_pmms",
    fetched_at: new Date().toISOString(),
    rates: { fixed_30yr, fixed_15yr },
  };
}

async function main() {
  // Load existing rates for fallback
  let existing: RateData | null = null;
  try {
    existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8")) as RateData;
  } catch {
    console.log("No existing rates.json found — will create fresh.");
  }

  try {
    const fresh = await fetchPMMS();

    // Anomaly detection: flag >3x change (shouldn't happen but guards against parse errors)
    if (existing) {
      const change30 = Math.abs(fresh.rates.fixed_30yr - existing.rates.fixed_30yr);
      const change15 = Math.abs(fresh.rates.fixed_15yr - existing.rates.fixed_15yr);
      if (change30 > 3 || change15 > 3) {
        console.error(
          `⛔ ANOMALY: Rate change exceeds 3%. Old: ${existing.rates.fixed_30yr}% / ${existing.rates.fixed_15yr}%, New: ${fresh.rates.fixed_30yr}% / ${fresh.rates.fixed_15yr}%.`
        );
        console.error("Keeping existing rates.json. Verify manually.");
        process.exit(1);
      }
    }

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(fresh, null, 2) + "\n");

    console.log(`✅ Rates updated:`);
    console.log(`   30-year: ${fresh.rates.fixed_30yr}%`);
    console.log(`   15-year: ${fresh.rates.fixed_15yr}%`);
    console.log(`   Fetched: ${fresh.fetched_at}`);
  } catch (err) {
    if (existing) {
      console.error(`❌ Fetch failed: ${(err as Error).message}`);
      console.error("Using last known good rates:", existing.rates);
      process.exit(1);
    } else {
      console.error(`❌ Fetch failed and no existing data: ${(err as Error).message}`);
      process.exit(1);
    }
  }
}

main();
