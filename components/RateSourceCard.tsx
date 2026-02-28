"use client";

import { useState } from "react";
import type { RateBreakdown } from "@/lib/types";

interface Props {
  breakdown: RateBreakdown;
}

const SOURCE_LABELS: Record<string, string> = {
  live: "Live",
  cached: "Cached",
  fallback: "Stored",
};

function fmtPct(decimal: number): string {
  return (decimal * 100).toFixed(2) + "%";
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function RateSourceCard({ breakdown }: Props) {
  const [expanded, setExpanded] = useState(false);

  const dotColor =
    breakdown.rateSource === "live"
      ? "bg-green-500"
      : breakdown.rateSource === "cached"
        ? "bg-blue-400"
        : "bg-gray-400";

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Collapsed summary row */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset transition-colors"
        aria-expanded={expanded}
        aria-controls="rate-breakdown-panel"
      >
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} aria-hidden />
          <span>
            Rates from <span className="font-medium text-gray-800">Freddie Mac PMMS</span>
            {" "}({SOURCE_LABELS[breakdown.rateSource] ?? breakdown.rateSource})
            {" · "}
            {fmtDate(breakdown.fetchedAt)}
          </span>
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
          {expanded ? "Hide breakdown ▴" : "See breakdown ▾"}
        </span>
      </button>

      {/* Expanded breakdown */}
      {expanded && (
        <div
          id="rate-breakdown-panel"
          className="border-t border-gray-100 px-4 py-4 bg-gray-50"
        >
          {breakdown.usingQuotedRate ? (
            <div className="text-sm text-gray-700">
              <p className="font-medium mb-1">Using your quoted rate</p>
              <p className="text-gray-600">
                All scenarios use your quoted rate of{" "}
                <span className="font-semibold text-gray-900">
                  {fmtPct(breakdown.quotedRate ?? 0)}
                </span>
                {" "}instead of market rates.
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Base market rates for reference — 30yr: {breakdown.baseRate30yr}%, 15yr: {breakdown.baseRate15yr}%
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Base rates */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Base Market Rates
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-sm">
                    <span className="text-gray-500">30-year fixed:</span>{" "}
                    <span className="font-semibold text-gray-900">{breakdown.baseRate30yr}%</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">15-year fixed:</span>{" "}
                    <span className="font-semibold text-gray-900">{breakdown.baseRate15yr}%</span>
                  </div>
                </div>
              </div>

              {/* Credit adjustment */}
              {(breakdown.creditSpread30 > 0 || breakdown.creditSpread15 > 0) && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Credit Tier Adjustment
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-sm">
                      <span className="text-gray-500">30yr:</span>{" "}
                      <span className="font-medium text-amber-700">
                        +{(breakdown.creditSpread30 * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-500">15yr:</span>{" "}
                      <span className="font-medium text-amber-700">
                        +{(breakdown.creditSpread15 * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Final rates per scenario */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Final Rates Used
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-sm">
                    <span className="block text-gray-500 text-xs">Same-Term</span>
                    <span className="font-semibold text-gray-900">{fmtPct(breakdown.finalRateSameTerm)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="block text-gray-500 text-xs">15-Year</span>
                    <span className="font-semibold text-gray-900">{fmtPct(breakdown.finalRate15yr)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="block text-gray-500 text-xs">30-Year</span>
                    <span className="font-semibold text-gray-900">{fmtPct(breakdown.finalRate30yr)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
