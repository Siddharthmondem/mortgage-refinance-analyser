#!/usr/bin/env node
// ============================================================
// Fetch Freddie Mac PMMS rates and write to data/rates.json
// Run weekly: npx tsx scripts/fetch_rates.ts
// ============================================================

import fs from "fs";
import path from "path";
import { fetchPMMSRates, validateRateChange } from "../lib/pmms";
import type { RateData } from "../lib/types";

const OUTPUT_PATH = path.resolve(process.cwd(), "data/rates.json");

async function main() {
  // Load existing rates for fallback
  let existing: RateData | null = null;
  try {
    existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8")) as RateData;
  } catch {
    console.log("No existing rates.json found — will create fresh.");
  }

  try {
    console.log("Fetching Freddie Mac PMMS rates...");
    const fresh = await fetchPMMSRates();

    // Anomaly detection: flag >3pt change
    if (existing) {
      const check = validateRateChange(fresh, existing);
      if (!check.valid) {
        console.error(`\u26D4 ANOMALY: ${check.reason}`);
        console.error("Keeping existing rates.json. Verify manually.");
        process.exit(1);
      }
    }

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(fresh, null, 2) + "\n");

    console.log(`\u2705 Rates updated:`);
    console.log(`   30-year: ${fresh.rates.fixed_30yr}%`);
    console.log(`   15-year: ${fresh.rates.fixed_15yr}%`);
    console.log(`   Fetched: ${fresh.fetched_at}`);
  } catch (err) {
    if (existing) {
      console.error(`\u274C Fetch failed: ${(err as Error).message}`);
      console.error("Using last known good rates:", existing.rates);
      process.exit(1);
    } else {
      console.error(
        `\u274C Fetch failed and no existing data: ${(err as Error).message}`
      );
      process.exit(1);
    }
  }
}

main();
