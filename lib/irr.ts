// ============================================================
// Refinance Clarity Engine — IRR Computation
// ============================================================
// Computes the Internal Rate of Return for a refi scenario,
// treating closing costs as an upfront investment.
//
// Cash flow model (two-period annuity):
//   CF[0]         = -fees                          (upfront cost)
//   CF[1..k]      = basePmt - refiPmt              (delta during refi loan period)
//   CF[k+1..N]    = basePmt                        (baseline payment saved after refi payoff)
//   CF[N] also += balanceSavedAtHorizon             (terminal equity benefit)
//
// Where k = min(refiTermMonths, horizonMonths).
//
// For same-term scenarios (refiTermMonths ≥ horizonMonths): k = N, so the
// second period is empty and the formula reduces to a simple annuity.
//
// For early-payoff scenarios (e.g., 15yr refi on a 25yr horizon): k = 180,
// and months 181–300 contribute the full baseline payment as savings.
// This correctly values equity acceleration — a constant monthlyDelta would
// miss those post-payoff savings entirely.
// ============================================================

/**
 * NPV of refi cash flows at a given monthly discount rate.
 *
 * Two-annuity decomposition:
 *   NPV(r) = -fees
 *     + (basePmt - refiPmt) × annuity(r, k)          // delta during refi period
 *     + basePmt × (annuity(r, N) - annuity(r, k))    // baseline savings after early payoff
 *     + balanceSaved / (1+r)^N                         // terminal balance benefit
 *
 * where k = min(refiTermMonths, N).
 */
function npv(
  r: number,
  fees: number,
  refiPmt: number,
  basePmt: number,
  refiTerm: number,
  balanceSaved: number,
  N: number
): number {
  const k = Math.min(refiTerm, N);
  const paymentDelta = basePmt - refiPmt; // positive = refi is cheaper each month

  if (r === 0) {
    // Annuity factor at r=0 is just N (undiscounted)
    return -fees + paymentDelta * k + basePmt * (N - k) + balanceSaved;
  }

  function annuity(months: number): number {
    if (months <= 0) return 0;
    return (1 - Math.pow(1 + r, -months)) / r;
  }

  const annuityK = annuity(k);
  const annuityN = annuity(N);
  const annuityAfter = annuityN - annuityK; // annuity for months k+1..N (0 if k === N)
  const discountN = Math.pow(1 + r, -N);

  return (
    -fees +
    paymentDelta * annuityK +
    basePmt * annuityAfter +
    balanceSaved * discountN
  );
}

/**
 * Compute the annualized IRR for a refi scenario's closing-cost investment.
 *
 * Cash flow model:
 *   During refi loan period (months 1..k where k = min(refiTermMonths, N)):
 *     monthly CF = basePmt - refiPmt  (positive = refi cheaper, negative = refi costs more)
 *   After refi payoff (months k+1..N, only when refi ends before horizon):
 *     monthly CF = basePmt  (baseline still paying, refi is free — full baseline savings)
 *   Terminal (month N):
 *     CF += balanceSavedAtHorizon
 *
 * @param fees                  - closing costs ($)
 * @param refiMonthlyPayment    - monthly payment for the refi scenario
 * @param baselineMonthlyPayment - monthly payment for the baseline (stay current) scenario
 * @param refiTermMonths        - full loan term of the refi (may be less than horizonMonths)
 * @param balanceSavedAtHorizon - baseline.remainingBalanceAtHorizon - refi.remainingBalanceAtHorizon
 * @param horizonMonths         - comparison horizon N
 * @returns annualized IRR = (1 + monthly_r)^12 - 1
 *          Infinity  — fees ≤ 0 (no-cost refi, infinite return)
 *          null      — no mathematical solution found in search range [-99%, 160000%] annual
 */
export function computeIRR(
  fees: number,
  refiMonthlyPayment: number,
  baselineMonthlyPayment: number,
  refiTermMonths: number,
  balanceSavedAtHorizon: number,
  horizonMonths: number
): number | null {
  if (horizonMonths <= 0) return null;
  if (fees <= 0) return Infinity;

  const args = [fees, refiMonthlyPayment, baselineMonthlyPayment, refiTermMonths, balanceSavedAtHorizon, horizonMonths] as const;

  // ---- Bisection over monthly rate ----
  // Search range: monthly [-0.08, 2.0] ≈ annual [-62%, ~160,000%]
  let lo = -0.08;
  let hi = 2.0;

  let npvLo = npv(lo, ...args);
  const npvHi = npv(hi, ...args);

  // Need a sign change to guarantee a root
  if ((npvLo >= 0) === (npvHi >= 0)) {
    // Expand lower bound toward -1 to catch deeply negative IRRs
    lo = -0.099; // approaching the -100%/month limit
    npvLo = npv(lo, ...args);
    if ((npvLo >= 0) === (npvHi >= 0)) {
      // Last resort: check [0, hi] — handles non-monotone NPV where a large
      // negative balanceSaved amplifies NPV to extreme values at negative rates,
      // obscuring a valid positive root above r=0 (e.g. 30yr reset at full term).
      const npvZero = npv(0, fees, refiMonthlyPayment, baselineMonthlyPayment, refiTermMonths, balanceSavedAtHorizon, horizonMonths);
      if ((npvZero >= 0) !== (npvHi >= 0)) {
        lo = 0;
        npvLo = npvZero;
      } else {
        return null;
      }
    }
  }

  // 100 bisection iterations → precision < $0.01 on typical mortgage amounts
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const npvMid = npv(mid, ...args);

    if (Math.abs(npvMid) < 0.01) {
      return Math.pow(1 + mid, 12) - 1;
    }

    if ((npvMid >= 0) === (npvLo >= 0)) {
      lo = mid;
      npvLo = npvMid;
    } else {
      hi = mid;
    }
  }

  const monthlyR = (lo + hi) / 2;
  return Math.pow(1 + monthlyR, 12) - 1;
}
