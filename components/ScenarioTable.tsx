"use client";

import { useState } from "react";
import type { ScenarioResult } from "@/lib/types";
import BreakEvenDisplay from "@/components/BreakEvenDisplay";

interface Props {
  scenarios: ScenarioResult[];
  horizonYears: number;
  horizonMonths: number;
}

function fmt$(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtRate(r: number): string {
  return (r * 100).toFixed(2) + "%";
}

function fmtDelta(n: number): string {
  if (n === 0) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "+";
  return sign + "$" + abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const SCENARIO_ORDER: Array<ScenarioResult["id"]> = [
  "stay_current",
  "refi_same_term",
  "refi_15yr",
  "refi_30yr",
];

export default function ScenarioTable({ scenarios, horizonYears, horizonMonths }: Props) {
  const [tableOpen, setTableOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const ordered = SCENARIO_ORDER
    .map((id) => scenarios.find((s) => s.id === id))
    .filter((s): s is ScenarioResult => s !== undefined);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Toggle header */}
      <button
        onClick={() => setTableOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
        aria-expanded={tableOpen}
        aria-controls="scenario-table-panel"
      >
        <span>View Detailed Comparison</span>
        <span className="text-gray-400 text-lg" aria-hidden="true">{tableOpen ? "▲" : "▼"}</span>
      </button>

      {tableOpen && (
        <div id="scenario-table-panel" className="border-t border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] text-sm" aria-label="Refinance scenario comparison">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th
                    scope="col"
                    className="px-3 py-3 font-medium text-gray-600 text-xs uppercase tracking-wide w-[130px] sm:w-[160px] sticky left-0 bg-gray-50 z-10"
                  >
                    <span className="sr-only">Metric</span>
                  </th>
                  {ordered.map((s) => (
                    <th
                      key={s.id}
                      scope="col"
                      className={`px-3 py-3 font-medium text-xs uppercase tracking-wide text-center ${
                        s.isBestLongTerm
                          ? "text-blue-700 bg-blue-50"
                          : "text-gray-600"
                      }`}
                    >
                      <div>{s.label}</div>
                      {s.isBestLongTerm && (
                        <div className="mt-0.5 text-blue-600 font-semibold normal-case text-xs">
                          ★ Best Long-Term
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {/* Rate */}
                <Row
                  label="Refi Rate"
                  values={ordered.map((s) =>
                    s.id === "stay_current" ? "—" : fmtRate(s.rate)
                  )}
                  winners={ordered.map((s) => s.isBestLongTerm)}
                />

                {/* Monthly payment */}
                <Row
                  label="Monthly Payment"
                  values={ordered.map((s) => fmt$(s.monthlyPayment))}
                  winners={ordered.map((s) => s.isBestLongTerm)}
                  highlight="min"
                  numbers={ordered.map((s) => s.monthlyPayment)}
                />

                {/* Monthly delta */}
                <Row
                  label="vs. Current Payment"
                  values={ordered.map((s) => fmtDelta(s.monthlyDelta))}
                  winners={ordered.map((s) => s.isBestLongTerm)}
                />

                {/* Net cost at horizon — primary ranking metric */}
                <Row
                  label={`Net Cost at Horizon (${horizonYears}yr)`}
                  values={ordered.map((s) => fmt$(s.netCostAtHorizon))}
                  winners={ordered.map((s) => s.isBestLongTerm)}
                  highlight="min"
                  numbers={ordered.map((s) => s.netCostAtHorizon)}
                  bold
                />

                {/* Break-even */}
                <tr className="hover:bg-gray-50 transition-colors">
                  <th
                    scope="row"
                    className="px-3 py-3 text-xs font-medium text-gray-500 whitespace-nowrap sticky left-0 bg-white z-10 border-r border-gray-100 text-left"
                  >
                    Break-Even
                  </th>
                  {ordered.map((s, i) => (
                    <td
                      key={i}
                      className={`px-3 py-3 text-center whitespace-nowrap ${
                        s.isBestLongTerm ? "bg-blue-50" : ""
                      }`}
                    >
                      {s.id === "stay_current" ? (
                        <span className="text-sm text-gray-400">—</span>
                      ) : (
                        <BreakEvenDisplay
                          interestBreakEvenMonths={s.interestBreakEvenMonths}
                          cashflowBreakEvenMonths={s.cashflowBreakEvenMonths}
                          horizonMonths={horizonMonths}
                        />
                      )}
                    </td>
                  ))}
                </tr>

                {/* Remaining balance */}
                <Row
                  label="Balance at Horizon End"
                  values={ordered.map((s) =>
                    s.remainingBalanceAtHorizon === 0
                      ? "$0"
                      : `${fmt$(s.remainingBalanceAtHorizon)} ⚠️`
                  )}
                  winners={ordered.map((s) => s.isBestLongTerm)}
                  warn={ordered.map((s) => s.remainingBalanceAtHorizon > 0)}
                />
              </tbody>
            </table>
          </div>

          {/* ── Expandable cost breakdown section ── */}
          <div className="border-t border-gray-100">
            <button
              onClick={() => setBreakdownOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400"
              aria-expanded={breakdownOpen}
              aria-controls="cost-breakdown-panel"
            >
              <span>Cost breakdown</span>
              <span aria-hidden="true">{breakdownOpen ? "▲" : "▼"}</span>
            </button>

            {breakdownOpen && (
              <div id="cost-breakdown-panel" className="overflow-x-auto border-t border-gray-100">
                <table className="w-full min-w-[540px] text-sm" aria-label="Cost breakdown detail">
                  <thead className="sr-only">
                    <tr>
                      <th>Metric</th>
                      {ordered.map((s) => <th key={s.id}>{s.label}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {/* Total interest */}
                    <Row
                      label={`Total Interest (${horizonYears}yr)`}
                      values={ordered.map((s) => fmt$(s.interestWithinHorizon))}
                      winners={ordered.map((s) => s.isBestLongTerm)}
                      highlight="min"
                      numbers={ordered.map((s) => s.interestWithinHorizon)}
                      muted
                    />

                    {/* Total payments */}
                    <Row
                      label="Total Payments"
                      values={ordered.map((s) => fmt$(s.paymentsWithinHorizon))}
                      winners={ordered.map((s) => s.isBestLongTerm)}
                      muted
                    />

                    {/* Closing costs */}
                    <Row
                      label="Closing Costs"
                      values={ordered.map((s) => (s.fees === 0 ? "—" : fmt$(s.fees)))}
                      winners={ordered.map((s) => s.isBestLongTerm)}
                      muted
                    />

                    {/* Cash paid */}
                    <Row
                      label="Cash Paid (no balance)"
                      values={ordered.map((s) => fmt$(s.cashOutflowWithinHorizon))}
                      winners={ordered.map((s) => s.isBestLongTerm)}
                      highlight="min"
                      numbers={ordered.map((s) => s.cashOutflowWithinHorizon)}
                      muted
                    />

                    {/* Formula line */}
                    <tr className="bg-gray-50">
                      <td
                        colSpan={ordered.length + 1}
                        className="px-3 py-2 text-xs text-gray-400 italic sticky left-0"
                      >
                        Net Cost = Cash Paid + Remaining Balance
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Warnings */}
          {ordered.some((s) => s.warnings.length > 0) && (
            <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 space-y-1.5">
              {ordered.flatMap((s) =>
                s.warnings.map((w, i) => (
                  <p key={`${s.id}-${i}`} className="text-xs text-amber-800">
                    <strong>{s.label}:</strong> {w}
                  </p>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Sub-component: table row ----

interface RowProps {
  label: string;
  values: string[];
  winners: boolean[];
  warn?: boolean[];
  highlight?: "min" | "max";
  numbers?: number[];
  bold?: boolean;
  muted?: boolean;
}

function Row({ label, values, winners, warn, highlight, numbers, bold, muted }: RowProps) {
  let winnerIdx = -1;
  if (highlight && numbers) {
    winnerIdx = highlight === "min"
      ? numbers.indexOf(Math.min(...numbers))
      : numbers.indexOf(Math.max(...numbers));
  }

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <th
        scope="row"
        className={`px-3 py-3 text-xs font-medium whitespace-nowrap sticky left-0 bg-white z-10 border-r border-gray-100 text-left ${
          muted ? "text-gray-400" : "text-gray-500"
        }`}
      >
        {label}
      </th>
      {values.map((val, i) => (
        <td
          key={i}
          className={`px-3 py-3 text-center text-sm whitespace-nowrap ${
            winners[i] ? "bg-blue-50" : ""
          } ${bold ? "font-semibold" : ""} ${
            warn?.[i] ? "text-amber-700 font-medium" : muted ? "text-gray-400" : "text-gray-900"
          } ${
            winnerIdx === i ? "text-green-700 font-semibold" : ""
          }`}
        >
          {val}
        </td>
      ))}
    </tr>
  );
}
