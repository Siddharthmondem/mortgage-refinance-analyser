import type { Metadata } from "next";
import ratesJson from "@/data/rates.json";

export const metadata: Metadata = {
  title: "Methodology — Refinance Clarity Engine",
  description:
    "Exactly how we calculate refinance break-even, scenario comparisons, and our verdict logic. Every formula shown.",
};

const RATES = ratesJson as { rates: { fixed_30yr: number; fixed_15yr: number }; fetched_at: string };

export default function MethodologyPage() {
  const rateDate = new Date(RATES.fetched_at).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <a href="/" className="font-bold text-gray-900 text-base hover:text-blue-600 transition-colors">
            ← Refinance Clarity Engine
          </a>
          <span className="text-sm text-gray-400">Methodology</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          How We Calculate
        </h1>
        <p className="text-gray-500 text-sm mb-10">
          Every number this tool produces comes from a deterministic formula.
          No AI-generated estimates. No guessing. No lender-influenced scoring.
        </p>

        <div className="space-y-10">

          {/* 1. Monthly Payment */}
          <Section title="1. Monthly Payment (P&I)">
            <p>
              We use the standard fixed-rate amortization formula used by every bank and calculator:
            </p>
            <Formula>
              {`M = P × [r × (1 + r)^n] / [(1 + r)^n − 1]

Where:
  P = remaining loan balance
  r = annual interest rate ÷ 12  (monthly rate)
  n = term in months
  M = monthly payment (principal + interest only)`}
            </Formula>
            <p>
              This is P&I only. It excludes property taxes, homeowner&apos;s insurance, PMI,
              and escrow — because those costs don&apos;t change when you refinance.
            </p>
          </Section>

          {/* 2. Scenarios */}
          <Section title="2. What We Compare">
            <p>
              We generate up to 4 scenarios and compare them over your selected{" "}
              <strong>comparison horizon</strong> — see section 3. This ensures
              apples-to-apples comparisons.
            </p>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Scenario</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Term</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Shown when</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <Row3 a="Stay Current (baseline)" b="Your remaining years" c="Always" />
                  <Row3 a="Refi — Same Term" b="Your remaining years" c="Refi rate < current rate" />
                  <Row3 a="Refi — 15-Year" b="15 years" c="You have > 15 years left AND refi rate < current rate" />
                  <Row3 a="Refi — 30-Year Reset" b="30 years" c="Refi rate < current rate" />
                </tbody>
              </table>
            </div>
          </Section>

          {/* 3. Horizon */}
          <Section title="3. Comparison Horizon">
            <p>
              The <strong>horizon</strong> is the time window over which we compare all
              scenarios. By default it equals your remaining loan term — the most conservative,
              long-run view.
            </p>
            <p>
              You can shorten it using the horizon selector (3 / 5 / 7 / 10 / Full years).
              This answers: <em>&ldquo;What&apos;s the best option if I plan to sell or move in X years?&rdquo;</em>
            </p>
            <p>
              Every metric responds to your horizon selection:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
              <li><strong>Net Cost at Horizon</strong> — recomputed over the selected window</li>
              <li><strong>Break-even</strong> — must occur within the horizon to count</li>
              <li><strong>Annual Return (IRR)</strong> — computed over the selected period</li>
              <li><strong>Verdict color</strong> — thresholds scale with horizon length</li>
            </ul>
            <p>
              A 30-year reset that looks expensive at full term may look attractive at 5 years —
              and vice versa. The horizon selector makes this visible.
            </p>
          </Section>

          {/* 4. Net Cost at Horizon */}
          <Section title="4. Net Cost at Horizon">
            <p>
              For each scenario we compute a single number that captures the true economic
              cost over your horizon — including what you&apos;ll still owe at the end:
            </p>
            <Formula>
              {`k = min(loan term months, horizon months)

paymentsWithinHorizon    = monthlyPayment × k
cashOutflowWithinHorizon = closingCosts + paymentsWithinHorizon
netCostAtHorizon         = cashOutflowWithinHorizon + remainingBalanceAtHorizon

Where remainingBalanceAtHorizon is what you still owe at month k
(0 if the loan is fully paid off before the horizon).`}
            </Formula>
            <p>
              <strong>Scenarios are ranked by netCostAtHorizon — lowest wins.</strong>{" "}
              This correctly penalises the 30-year reset for the balance still owed at
              horizon end, even if its monthly payment is lower.
            </p>
            <p>
              <code className="bg-gray-100 px-1 rounded text-xs">cashOutflowWithinHorizon</code>{" "}
              (cash paid, ignoring balance) is shown as a secondary metric in the table for
              reference — useful if you plan to sell and pocket the equity difference.
            </p>
          </Section>

          {/* 5. Remaining Balance (30yr trap) */}
          <Section title='5. Remaining Balance at Horizon End ("Term Reset Trap")'>
            <p>
              When a 30-year refi extends past your original payoff date, we use the
              closed-form balance formula to compute exactly what you still owe:
            </p>
            <Formula>
              {`Balance at month k = P × (1+r)^k − M × [(1+r)^k − 1] / r`}
            </Formula>
            <p>
              This is the money you&apos;ll still owe at the point your old loan
              would have been paid off. A 30-year refi may appear cheaper on a
              month-by-month basis while actually costing significantly more in total.
              We flag this as a &ldquo;Term Reset Trap&rdquo; at full horizon, or a
              &ldquo;Term Reset Tradeoff&rdquo; at shorter horizons where the balance
              difference is smaller.
            </p>
          </Section>

          {/* 6. Break-Even */}
          <Section title="6. Break-Even">
            <p>We compute two break-even values for each scenario:</p>
            <p>
              <strong>Interest break-even</strong> (primary, shown in the table) — the first
              month where cumulative <em>interest savings</em> cover closing costs:
            </p>
            <Formula>
              {`For each month m from 1 to horizon:
  monthly_interest_benefit[m] = baseline_interest[m] − refi_interest[m]
  cumulative_interest_savings[m] = Σ monthly_interest_benefit[1..m]

  Interest break-even = first m where cumulative_interest_savings[m] ≥ closing_costs`}
            </Formula>
            <p>
              This correctly handles scenarios where the monthly payment{" "}
              <em>increases</em> (e.g., a 15-year refi) — the interest savings can still
              be large enough to recoup closing costs quickly, even though cashflow is
              negative each month.
            </p>
            <p>
              <strong>Cashflow break-even</strong> (shown in tooltip) — the simpler payback
              period based on the monthly payment <em>delta</em>:
            </p>
            <Formula>
              {`Cashflow break-even = closing_costs ÷ (baseline_payment − refi_payment)

null if refi_payment ≥ baseline_payment (payment increased — never recoups via cashflow)`}
            </Formula>
            <p>
              Both values are shown side-by-side in the break-even tooltip. The interest
              break-even is preferred because it accounts for the full cost of debt, not
              just cash out of pocket each month.
            </p>
          </Section>

          {/* 7. IRR */}
          <Section title="7. Annual Return on Closing Costs (IRR)">
            <p>
              The IRR frames closing costs as an <em>investment</em> and computes the
              annualised rate of return you earn over your horizon — making it directly
              comparable to other uses of that cash.
            </p>
            <p>
              Cash flow model (two-period annuity):
            </p>
            <Formula>
              {`CF[0]      = −closingCosts                     (upfront outlay)
CF[1..k]   = baselinePayment − refiPayment      (monthly delta during refi period)
CF[k+1..N] = baselinePayment                    (baseline still paying after refi pays off)
CF[N]     += balanceSavedAtHorizon               (terminal equity benefit)

Where k = min(refiTermMonths, horizonMonths), N = horizonMonths

NPV(r) = −fees
       + (basePmt − refiPmt) × annuity(r, k)
       + basePmt × (annuity(r, N) − annuity(r, k))
       + balanceSaved / (1+r)^N

annuity(r, n) = (1 − (1+r)^−n) / r`}
            </Formula>
            <p>
              The monthly IRR is the root of NPV(r) = 0, found by bisection (100 iterations).
              The annualised IRR is then <code className="bg-gray-100 px-1 rounded text-xs">(1 + monthly_r)^12 − 1</code>.
            </p>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Case</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Display</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <Row2 a="Closing costs = $0" b="∞ (infinite return — no investment made)" />
                  <Row2 a="No mathematical solution in range" b="N/A" />
                  <Row2 a="Stay current" b="— (no investment)" />
                  <Row2 a="Negative IRR" b="−X.X% shown in amber (bad deal)" />
                </tbody>
              </table>
            </div>
            <p className="mt-2">
              The two-period model is critical for 15-year scenarios: the monthly payment is
              higher than baseline, but after month 180 the refi is paid off while the baseline
              still charges the full payment. Treating that post-payoff period as pure savings
              (rather than ignoring it) gives the correct, higher IRR.
            </p>
          </Section>

          {/* 8. Verdict */}
          <Section title="8. Verdict Logic">
            <p>
              We select the scenario with the lowest <strong>Net Cost at Horizon</strong> as
              the winner, then compute:
            </p>
            <Formula>
              {`ratio = interestBreakEvenMonths / horizonMonths
netSavings = baseline.netCostAtHorizon − winner.netCostAtHorizon
horizonYears = horizonMonths / 12`}
            </Formula>
            <p>Thresholds scale with the selected horizon:</p>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Verdict</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Conditions</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Example at 5yr / 10yr</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr className="bg-green-50">
                    <td className="px-4 py-3 font-semibold text-green-800">✅ Refinance Looks Strong</td>
                    <td className="px-4 py-3 text-gray-700 text-xs">
                      ratio &lt; 0.33<br />AND netSavings &gt; $200 × horizonYears
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      BE &lt; 20mo, save &gt;$1k<br />BE &lt; 40mo, save &gt;$2k
                    </td>
                  </tr>
                  <tr className="bg-amber-50">
                    <td className="px-4 py-3 font-semibold text-amber-800">⚠️ Worth a Closer Look</td>
                    <td className="px-4 py-3 text-gray-700 text-xs">
                      ratio &lt; 0.67<br />AND netSavings &gt; $50 × horizonYears
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      BE &lt; 40mo, save &gt;$250<br />BE &lt; 80mo, save &gt;$500
                    </td>
                  </tr>
                  <tr className="bg-red-50">
                    <td className="px-4 py-3 font-semibold text-red-800">❌ Stay With Your Current Loan</td>
                    <td className="px-4 py-3 text-gray-700 text-xs">
                      Break-even after horizon, or<br />negative savings, or thresholds not met
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-gray-500">
              Using ratio-based thresholds (rather than fixed months) means the verdict
              correctly tightens at short horizons — a 20-month break-even is strong for a
              10-year horizon but marginal for a 3-year one.
            </p>
          </Section>

          {/* 9. Rates */}
          <Section title="9. Where Rates Come From">
            <p>
              We use the{" "}
              <strong>Freddie Mac Primary Mortgage Market Survey (PMMS)</strong> — the
              most widely cited weekly average mortgage rate source in the US, published
              every Thursday.
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 mt-2">
              <li>Current 30-year rate: <strong>{RATES.rates.fixed_30yr}%</strong></li>
              <li>Current 15-year rate: <strong>{RATES.rates.fixed_15yr}%</strong></li>
              <li>Last updated: <strong>{rateDate}</strong></li>
            </ul>
            <p className="mt-3">
              For &quot;same remaining term&quot; scenarios between 15 and 30 years, we
              linearly interpolate between the two PMMS rates. This is an approximation —
              actual rates for non-standard terms vary by lender.
            </p>
          </Section>

          {/* 10. Credit Tier */}
          <Section title="10. Credit Tier Adjustments">
            <p>
              National average rates assume excellent credit. We apply estimated spreads
              based on typical lender pricing tiers:
            </p>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Tier</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">FICO Range</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">30-yr spread</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">15-yr spread</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <Row4 a="Excellent" b="740+" c="+0.00%" d="+0.00%" />
                  <Row4 a="Good" b="670–739" c="+0.50%" d="+0.40%" />
                  <Row4 a="Fair" b="620–669" c="+1.25%" d="+1.00%" />
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-gray-500">
              These are estimates. Your actual rate depends on full lender underwriting,
              loan-to-value ratio, property type, and other factors. Enter your quoted
              rate if you have one — it overrides these estimates.
            </p>
          </Section>

          {/* 11. What we don't include */}
          <Section title="11. What We Don't Include">
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
              <li>Property taxes</li>
              <li>Homeowner&apos;s insurance</li>
              <li>Private mortgage insurance (PMI)</li>
              <li>Escrow payments</li>
              <li>Adjustable-rate mortgages (ARMs)</li>
              <li>HELOCs or cash-out refinance</li>
              <li>Opportunity cost of closing costs (investing vs. paying fees)</li>
              <li>Tax deductibility of mortgage interest</li>
            </ul>
            <p className="mt-3 text-sm text-gray-500">
              These exclusions are by design. We focus on P&I comparison because that&apos;s
              what changes when you refinance. The excluded items are either constant across
              scenarios or too situation-specific to generalize.
            </p>
          </Section>

          {/* 12. Philosophy */}
          <Section title="12. Our Philosophy">
            <blockquote className="border-l-4 border-blue-300 pl-4 text-gray-700 italic">
              We&apos;d rather tell you not to refinance than push you into a bad deal.
            </blockquote>
            <p className="mt-3">
              This tool has no lender relationships, no affiliate fees, and no incentive to
              recommend refinancing. If staying with your current loan is the right answer,
              we say so — clearly, at the top of the page.
            </p>
            <p>
              All logic is rule-based and auditable. If you spot an error in our math,{" "}
              please let us know.
            </p>
          </Section>

        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white mt-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 text-xs text-gray-400 text-center">
          This tool provides estimates for educational purposes only. It is not financial advice.
          Consult a licensed mortgage professional before making decisions.
        </div>
      </footer>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
      <h2 className="font-bold text-gray-900 text-base">{title}</h2>
      <div className="text-sm text-gray-600 space-y-3 leading-relaxed">{children}</div>
    </section>
  );
}

function Formula({ children }: { children: string }) {
  return (
    <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-800 overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">
      {children}
    </pre>
  );
}

function Row2({ a, b }: { a: string; b: string }) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 font-medium text-gray-800">{a}</td>
      <td className="px-4 py-3 text-gray-600 text-xs">{b}</td>
    </tr>
  );
}

function Row3({ a, b, c }: { a: string; b: string; c: string }) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 font-medium text-gray-800">{a}</td>
      <td className="px-4 py-3 text-gray-600">{b}</td>
      <td className="px-4 py-3 text-gray-600 text-xs">{c}</td>
    </tr>
  );
}

function Row4({ a, b, c, d }: { a: string; b: string; c: string; d: string }) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 font-medium text-gray-800">{a}</td>
      <td className="px-4 py-3 text-gray-600">{b}</td>
      <td className="px-4 py-3 text-gray-600">{c}</td>
      <td className="px-4 py-3 text-gray-600">{d}</td>
    </tr>
  );
}
