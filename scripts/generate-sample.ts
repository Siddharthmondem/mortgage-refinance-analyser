// Generate sample JSON output for documentation
import { runEngine } from "../lib/comparison";
import type { EngineInput } from "../lib/types";

const sampleInput: EngineInput = {
  remainingBalance: 320_000,
  currentAnnualRate: 0.0695,   // 6.95%
  yearsRemaining: 23,
  closingCosts: 6_400,         // 2% of balance
  refiRateSameTerm: 0.0575,    // PMMS-interpolated for 23yr
  refiRate15yr: 0.0525,        // PMMS 15yr
  refiRate30yr: 0.06,          // PMMS 30yr
};

const output = runEngine(sampleInput);

console.log(JSON.stringify(output, null, 2));
