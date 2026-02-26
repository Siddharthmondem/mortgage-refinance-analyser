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
            <p>We generate up to 4 scenarios and compare them over your <em>remaining horizon</em> — the years left on your current loan. This ensures apples-to-apples comparisons.</p>
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

          {/* 3. Total Cost */}
          <Section title="3. Total Cost Over Horizon">
            <p>For each scenario, we compute:</p>
            <Formula>
              {`Total Cost = Interest Paid Within Horizon + Closing Costs

Interest Within Horizon = Total Payments − Principal Repaid
  = (Monthly Payment × k) − (Starting Balance − Balance at month k)

where k = min(remaining months, loan term months)`}
            </Formula>
            <p>
              For the <strong>30-year reset</strong>, the loan extends past your original
              payoff date. We compute interest only for your original remaining years — but we
              also show the <strong>remaining balance at horizon end</strong> separately,
              because that money is still owed.
            </p>
          </Section>

          {/* 4. Remaining Balance (30yr trap) */}
          <Section title='4. Remaining Balance at Horizon End ("Term Reset Trap")'>
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
              month-by-month basis while actually costing you significantly more in total.
              We flag this explicitly.
            </p>
          </Section>

          {/* 5. Break-Even */}
          <Section title="5. Break-Even">
            <p>We compute the true break-even month-by-month:</p>
            <Formula>
              {`For each month m from 1 to horizon:
  monthly_benefit[m] = baseline_interest[m] − refi_interest[m]
  cumulative_savings[m] = Σ monthly_benefit[1..m]

  Break-even = first m where cumulative_savings[m] ≥ closing_costs`}
            </Formula>
            <p>
              This method correctly handles scenarios where your monthly payment
              <em> increases</em> (e.g., a 15-year refi) but interest savings are still large
              enough to recoup closing costs quickly. A simple payment-delta formula
              would incorrectly show &quot;no break-even&quot; in this case.
            </p>
          </Section>

          {/* 6. Verdict */}
          <Section title="6. Verdict Logic">
            <p>We select the scenario with the lowest total cost over your horizon as the winner, then apply these thresholds:</p>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Verdict</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Conditions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr className="bg-green-50">
                    <td className="px-4 py-3 font-semibold text-green-800">✅ Refinance Looks Strong</td>
                    <td className="px-4 py-3 text-gray-700 text-xs">Break-even &lt; 24 months AND net savings &gt; $2,000</td>
                  </tr>
                  <tr className="bg-amber-50">
                    <td className="px-4 py-3 font-semibold text-amber-800">⚠️ Worth a Closer Look</td>
                    <td className="px-4 py-3 text-gray-700 text-xs">Break-even 24–48 months OR net savings $500–$2,000</td>
                  </tr>
                  <tr className="bg-red-50">
                    <td className="px-4 py-3 font-semibold text-red-800">❌ Stay With Your Current Loan</td>
                    <td className="px-4 py-3 text-gray-700 text-xs">Break-even &gt; 48 months OR net savings &lt; $500 OR negative savings</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* 7. Rates */}
          <Section title="7. Where Rates Come From">
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

          {/* 8. Credit Tier */}
          <Section title="8. Credit Tier Adjustments">
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

          {/* 9. What we don't include */}
          <Section title="9. What We Don't Include">
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

          {/* 10. Philosophy */}
          <Section title="10. Our Philosophy">
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
