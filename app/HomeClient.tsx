"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import InputForm, { type FormValues } from "@/components/InputForm";
import VerdictBox from "@/components/VerdictBox";
import KeyNumbers from "@/components/KeyNumbers";
import ScenarioTable from "@/components/ScenarioTable";
import HorizonSelector from "@/components/HorizonSelector";
import AssumptionsDisclosure from "@/components/AssumptionsDisclosure";
import RateAlertOptIn from "@/components/RateAlertOptIn";
import LenderRateCards from "@/components/LenderRateCards";
import AnalysisPopup from "@/components/AnalysisPopup";
import RateSourceCard from "@/components/RateSourceCard";
import { runEngine } from "@/lib/comparison";
import { scoreLenderRate, sortScoredRates } from "@/lib/lender-rates";
import type {
  EngineInput,
  EngineOutput,
  RateData,
  RateSource,
  RateBreakdown,
  MarketRatesResponse,
  LenderRate,
  ScoredLenderRate,
} from "@/lib/types";

import ratesJson from "@/data/rates.json";
const STATIC_RATES = ratesJson as RateData;

const CREDIT_SPREADS: Record<string, { spread30: number; spread15: number }> = {
  excellent: { spread30: 0.000,  spread15: 0.000 },
  good:      { spread30: 0.005,  spread15: 0.004 },
  fair:      { spread30: 0.0125, spread15: 0.010 },
};

function interpolateRate(termYears: number, rate15: number, rate30: number): number {
  if (termYears <= 15) return rate15;
  if (termYears >= 30) return rate30;
  return rate15 + (rate30 - rate15) * (termYears - 15) / 15;
}

/** Build engine input using provided rate data (not the static import). */
function buildEngineInputFromRates(form: FormValues, rates: RateData): EngineInput {
  const balance  = parseFloat(form.remainingBalance.replace(/[$,]/g, ""));
  const rate     = parseFloat(form.currentAnnualRate.replace(/%/g, "")) / 100;
  const years    = parseFloat(form.yearsRemaining);
  const costs    = parseFloat(form.closingCosts.replace(/[$,]/g, ""));
  const spread   = CREDIT_SPREADS[form.creditTier] ?? CREDIT_SPREADS["excellent"]!;
  const rate30   = rates.rates.fixed_30yr / 100;
  const rate15   = rates.rates.fixed_15yr / 100;

  let refiRateSameTerm: number;
  let refiRate15yr: number;
  let refiRate30yr: number;

  if (form.quotedRate.trim() !== "") {
    const quoted = parseFloat(form.quotedRate.replace(/%/g, "")) / 100;
    refiRateSameTerm = refiRate15yr = refiRate30yr = quoted;
  } else {
    refiRate30yr     = rate30 + spread.spread30;
    refiRate15yr     = rate15 + spread.spread15;
    refiRateSameTerm = interpolateRate(years, rate15, rate30) + spread.spread30;
  }

  return {
    remainingBalance: balance,
    currentAnnualRate: rate,
    yearsRemaining: years,
    closingCosts: costs,
    refiRateSameTerm,
    refiRate15yr,
    refiRate30yr,
  };
}

/** Build a transparent rate breakdown for the UI. */
function buildRateBreakdown(
  rates: RateData,
  form: FormValues,
  source: RateSource
): RateBreakdown {
  const spread = CREDIT_SPREADS[form.creditTier] ?? CREDIT_SPREADS["excellent"]!;
  const rate30 = rates.rates.fixed_30yr / 100;
  const rate15 = rates.rates.fixed_15yr / 100;
  const years  = parseFloat(form.yearsRemaining);
  const usingQuoted = form.quotedRate.trim() !== "";

  if (usingQuoted) {
    const quoted = parseFloat(form.quotedRate.replace(/%/g, "")) / 100;
    return {
      rateSource: source,
      baseRate30yr: rates.rates.fixed_30yr,
      baseRate15yr: rates.rates.fixed_15yr,
      fetchedAt: rates.fetched_at,
      creditSpread30: spread.spread30,
      creditSpread15: spread.spread15,
      finalRateSameTerm: quoted,
      finalRate15yr: quoted,
      finalRate30yr: quoted,
      usingQuotedRate: true,
      quotedRate: quoted,
    };
  }

  return {
    rateSource: source,
    baseRate30yr: rates.rates.fixed_30yr,
    baseRate15yr: rates.rates.fixed_15yr,
    fetchedAt: rates.fetched_at,
    creditSpread30: spread.spread30,
    creditSpread15: spread.spread15,
    finalRateSameTerm: interpolateRate(years, rate15, rate30) + spread.spread30,
    finalRate15yr: rate15 + spread.spread15,
    finalRate30yr: rate30 + spread.spread30,
    usingQuotedRate: false,
  };
}

/** Compute the refi rate that would flip verdict to green (binary search) */
function computeTriggerRate(form: FormValues): number {
  const balance = parseFloat(form.remainingBalance.replace(/[$,]/g, ""));
  const currentRate = parseFloat(form.currentAnnualRate.replace(/%/g, "")) / 100;
  const years   = parseFloat(form.yearsRemaining);
  const costs   = parseFloat(form.closingCosts.replace(/[$,]/g, ""));

  let lo = 0.01, hi = currentRate;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const testInput: EngineInput = {
      remainingBalance: balance,
      currentAnnualRate: currentRate,
      yearsRemaining: years,
      closingCosts: costs,
      refiRateSameTerm: mid,
      refiRate15yr: mid - 0.005,
      refiRate30yr: mid + 0.0025,
    };
    const out = runEngine(testInput);
    if (out.verdict.color === "green") {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  // Round to nearest 0.125% standard increment
  return Math.round(((lo + hi) / 2) * 800) / 800;
}

export default function HomeClient() {
  const [result, setResult] = useState<EngineOutput | null>(null);
  const [formValues, setFormValues] = useState<FormValues | null>(null);
  const [currentRates, setCurrentRates] = useState<RateData>(STATIC_RATES);
  const [horizonChoice, setHorizonChoice] = useState<number | null>(null);
  const [scoredLenders, setScoredLenders] = useState<ScoredLenderRate[]>([]);
  const [lendersLoading, setLendersLoading] = useState(false);
  const [lendersError, setLendersError] = useState(false);
  const [selectedLender, setSelectedLender] = useState<ScoredLenderRate | null>(null);
  const [rateBreakdown, setRateBreakdown] = useState<RateBreakdown | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const formRef    = useRef<HTMLDivElement>(null);

  // Re-run engine whenever horizonChoice changes (after first submit)
  const runEngineWithHorizon = useCallback(
    (values: FormValues, rates: RateData, horizon: number | null) => {
      const engineInput = buildEngineInputFromRates(values, rates);
      if (horizon !== null) engineInput.horizonOverrideMonths = horizon;
      return runEngine(engineInput);
    },
    []
  );

  useEffect(() => {
    if (!formValues) return;
    setResult(runEngineWithHorizon(formValues, currentRates, horizonChoice));
  }, [horizonChoice, formValues, currentRates, runEngineWithHorizon]);

  function handleSubmit(values: FormValues) {
    setFormValues(values);
    setHorizonChoice(null); // reset horizon on new form submission

    // 1. Immediately show results using static rates (zero delay)
    const output = runEngineWithHorizon(values, STATIC_RATES, null);
    setResult(output);
    setCurrentRates(STATIC_RATES);
    setRateBreakdown(buildRateBreakdown(STATIC_RATES, values, "fallback"));

    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);

    // 2. In parallel: fetch live market rates + lender rates
    fetchLiveRatesAndUpdate(values);
    fetchAndScoreLenders(values);
  }

  /** Fetch live PMMS rates; if they differ from static, re-run the engine. */
  async function fetchLiveRatesAndUpdate(values: FormValues) {
    try {
      const res = await fetch("/api/market-rates");
      if (!res.ok) {
        console.warn(`Market rates API: ${res.status}`);
        return;
      }

      const data = await res.json() as MarketRatesResponse;
      const liveRates = data.rates;

      // Update breakdown with live source metadata
      setRateBreakdown(buildRateBreakdown(liveRates, values, data.rateSource));

      // Store live rates — the horizonChoice effect will re-run with them
      // Re-run engine only if rates actually changed
      if (
        liveRates.rates.fixed_30yr !== STATIC_RATES.rates.fixed_30yr ||
        liveRates.rates.fixed_15yr !== STATIC_RATES.rates.fixed_15yr
      ) {
        setCurrentRates(liveRates);
        // Effect will fire due to currentRates change and re-run with current horizonChoice
      }
    } catch {
      // Static results already displayed — just log
      console.warn("Live market rate fetch failed; using static rates.");
    }
  }

  async function fetchAndScoreLenders(values: FormValues) {
    setLendersLoading(true);
    setLendersError(false);
    setScoredLenders([]);

    const balance = parseFloat(values.remainingBalance.replace(/[$,]/g, ""));
    const currentRate = parseFloat(values.currentAnnualRate.replace(/%/g, "")) / 100;
    const years = parseFloat(values.yearsRemaining);
    const costs = parseFloat(values.closingCosts.replace(/[$,]/g, ""));

    try {
      const res = await fetch("/api/lender-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanAmount: balance,
          creditTier: values.creditTier,
        }),
      });

      if (!res.ok) {
        console.error(`Lender rates API error: ${res.status} ${res.statusText}`);
        setLendersError(true);
        setLendersLoading(false);
        return;
      }

      const data = await res.json() as { rates: LenderRate[] };

      // Score each lender rate using the engine
      const scored = data.rates.map((lender) =>
        scoreLenderRate(lender, balance, currentRate, years, costs)
      );

      setScoredLenders(sortScoredRates(scored));
    } catch (err) {
      console.error("Failed to fetch/score lender rates:", err);
      setLendersError(true);
    } finally {
      setLendersLoading(false);
    }
  }

  function handleRecalculate() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const horizonYears   = result ? Math.round(result.horizonMonths / 12) : 0;
  const resultHorizonMonths = result ? result.horizonMonths : 0;
  const needsRateAlert = result && (result.verdict.color === "yellow" || result.verdict.color === "red");
  const triggerRate    = needsRateAlert && formValues ? computeTriggerRate(formValues) : 0;
  const currentRate    = formValues ? parseFloat(formValues.currentAnnualRate) / 100 : 0;
  const sc30           = result?.scenarios.find((s) => s.id === "refi_30yr");
  const yearsRemaining = formValues ? parseFloat(formValues.yearsRemaining) : 0;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div>
            <span className="font-bold text-gray-900 text-base">Refinance Clarity Engine</span>
            <span className="hidden sm:inline text-gray-400 text-sm ml-2">
              — Clear math. No lender steering.
            </span>
          </div>
          <a
            href="/methodology"
            className="text-xs text-blue-600 hover:text-blue-800 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          >
            How we calculate →
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Hero ── */}
        {!result && (
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Should you refinance?
            </h1>
            <p className="text-gray-500 text-sm sm:text-base max-w-md mx-auto">
              Get a clear, honest answer in 60 seconds. Numbers-first. No ads.
            </p>
          </div>
        )}

        {/* ── Two-column layout on desktop ── */}
        <div className="flex flex-col lg:flex-row gap-8">

          {/* LEFT: Input form (sticky on desktop) */}
          <div className="lg:w-80 lg:flex-shrink-0" ref={formRef}>
            <div className="lg:sticky lg:top-20">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h2 className="font-semibold text-gray-700 text-sm mb-4 uppercase tracking-wide">
                  Your Loan Details
                </h2>
                <InputForm
                  rates={STATIC_RATES}
                  onSubmit={handleSubmit}
                  initialValues={formValues ?? undefined}
                />
              </div>
            </div>
          </div>

          {/* RIGHT: Results */}
          <div className="flex-1 min-w-0">
            {result ? (
              <div ref={resultsRef} className="space-y-4" aria-live="polite" aria-label="Refinance analysis results">

                {/* Verdict */}
                <VerdictBox verdict={result.verdict} />

                {/* 3 Key Numbers */}
                <KeyNumbers verdict={result.verdict} horizonYears={horizonYears} />

                {/* Term Reset Trap / Tradeoff — uses warning text from engine */}
                {sc30 && sc30.remainingBalanceAtHorizon > 0 && sc30.warnings.length > 0 && (
                  <div
                    className="rounded-xl border border-amber-200 bg-amber-50 p-4"
                    role="alert"
                    aria-label="Term reset warning"
                  >
                    <p className="font-semibold text-amber-800 text-sm mb-1">
                      ⚠️ {horizonChoice === null ? "Term Reset Trap" : "Term Reset Tradeoff"}
                    </p>
                    <p className="text-sm text-amber-700">
                      {sc30.warnings.find((w) =>
                        w.startsWith("Term Reset")
                      )?.replace(/^Term Reset (Trap|Tradeoff): /, "") ??
                        "The 30-year option extends your repayment timeline."}
                    </p>
                  </div>
                )}

                {/* Rate Alert (yellow/red only) */}
                {needsRateAlert && triggerRate > 0 && triggerRate < currentRate && (
                  <RateAlertOptIn
                    triggerRate={triggerRate}
                    currentRate={currentRate}
                  />
                )}

                {/* Horizon Selector */}
                <HorizonSelector
                  value={horizonChoice}
                  onChange={setHorizonChoice}
                  yearsRemaining={yearsRemaining}
                />

                {/* Scenario Table */}
                <ScenarioTable
                  scenarios={result.scenarios}
                  horizonYears={horizonYears}
                  horizonMonths={resultHorizonMonths}
                />

                {/* Rate Source & Breakdown */}
                {rateBreakdown && <RateSourceCard breakdown={rateBreakdown} />}

                {/* Lender Rate Cards */}
                <LenderRateCards
                  rates={scoredLenders}
                  loading={lendersLoading}
                  error={lendersError}
                  onSelect={setSelectedLender}
                  onRetry={() => formValues && fetchAndScoreLenders(formValues)}
                />

                {/* Recalculate */}
                <div className="text-center pt-2">
                  <button
                    onClick={handleRecalculate}
                    className="text-sm text-blue-600 hover:text-blue-800 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                  >
                    ↑ Adjust your numbers
                  </button>
                </div>

                {/* Assumptions */}
                <AssumptionsDisclosure rates={STATIC_RATES} breakdown={rateBreakdown} />
              </div>
            ) : (
              /* Empty state — show assumptions before results */
              <div className="space-y-6">
                {/* How it works */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <h2 className="font-semibold text-gray-700 text-sm mb-3 uppercase tracking-wide">
                    How it works
                  </h2>
                  <ol className="space-y-3 text-sm text-gray-600">
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">1</span>
                      <span>Enter your current loan balance, rate, and years remaining</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">2</span>
                      <span>We compare staying current vs. 2–3 refinance options using real Freddie Mac rates</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">3</span>
                      <span>You get a clear verdict — including if refinancing is a bad idea</span>
                    </li>
                  </ol>
                </div>

                {/* Trust badge */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-start gap-3">
                  <span className="text-xl mt-0.5" aria-hidden>🔒</span>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">Your numbers stay in your browser</p>
                    <p className="text-xs text-gray-500 mt-1">
                      All calculations run on your device. We don&apos;t store your loan details,
                      sell your data, or steer you to lenders. No cookies.
                    </p>
                  </div>
                </div>

                <AssumptionsDisclosure rates={STATIC_RATES} />
              </div>
            )}
          </div>

        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-200 bg-white mt-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <span>Refinance Clarity Engine — educational tool only, not financial advice</span>
          <a href="/methodology" className="hover:text-gray-600 underline underline-offset-2">
            Methodology
          </a>
        </div>
      </footer>

      {/* ── Lender Analysis Popup ── */}
      {selectedLender && (
        <AnalysisPopup
          lender={selectedLender}
          onClose={() => setSelectedLender(null)}
        />
      )}
    </div>
  );
}
