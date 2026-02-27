"use client";

import type { ScoredLenderRate } from "@/lib/types";

interface Props {
  rates: ScoredLenderRate[];
  loading: boolean;
  error?: boolean;
  onSelect: (lender: ScoredLenderRate) => void;
  onRetry?: () => void;
}

const VERDICT_CONFIG = {
  green: {
    badge: "STRONG DEAL",
    icon: "\u2705",
    iconLabel: "Strong deal",
    borderColor: "border-green-200",
    bgColor: "bg-green-50",
    badgeBg: "bg-green-100 text-green-800",
    opacity: "",
  },
  yellow: {
    badge: "WORTH A LOOK",
    icon: "\u26a0\ufe0f",
    iconLabel: "Worth a look",
    borderColor: "border-amber-200",
    bgColor: "bg-amber-50",
    badgeBg: "bg-amber-100 text-amber-800",
    opacity: "",
  },
  red: {
    badge: "NOT WORTH IT",
    icon: "\u274c",
    iconLabel: "Not worth it",
    borderColor: "border-red-200",
    bgColor: "bg-red-50",
    badgeBg: "bg-red-100 text-red-800",
    opacity: "opacity-70",
  },
} as const;

function formatDollars(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatRate(decimal: number): string {
  return (decimal * 100).toFixed(2);
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-gray-200 bg-white p-5 animate-pulse"
        >
          <div className="h-5 bg-gray-200 rounded w-24 mb-3" />
          <div className="h-4 bg-gray-100 rounded w-32 mb-2" />
          <div className="h-6 bg-gray-200 rounded w-40 mb-4" />
          <div className="space-y-2">
            <div className="h-3 bg-gray-100 rounded w-28" />
            <div className="h-3 bg-gray-100 rounded w-32" />
            <div className="h-3 bg-gray-100 rounded w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LenderRateCards({ rates, loading, error, onSelect, onRetry }: Props) {
  if (loading) {
    return (
      <section className="mt-6" aria-label="Lender rate comparison">
        <h2 className="font-semibold text-gray-700 text-sm mb-4 uppercase tracking-wide">
          Compare Lender Rates
        </h2>
        <LoadingSkeleton />
      </section>
    );
  }

  if (error) {
    return (
      <section className="mt-6" aria-label="Lender rate comparison">
        <h2 className="font-semibold text-gray-700 text-sm mb-4 uppercase tracking-wide">
          Compare Lender Rates
        </h2>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
          <p className="text-sm text-amber-800 mb-2">
            Unable to load lender rates right now.
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-sm text-blue-600 hover:text-blue-800 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            >
              Try again
            </button>
          )}
        </div>
      </section>
    );
  }

  if (rates.length === 0) return null;

  return (
    <section className="mt-6" aria-label="Lender rate comparison">
      <div className="mb-4">
        <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
          Compare Lender Rates
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Personalized for your loan. Sorted by best deal for you, not lowest rate.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {rates.map((lender) => {
          const cfg = VERDICT_CONFIG[lender.verdict.color];
          return (
            <button
              key={lender.id}
              onClick={() => onSelect(lender)}
              className={`
                rounded-xl border ${cfg.borderColor} ${cfg.bgColor} ${cfg.opacity}
                p-5 text-left transition-all
                hover:shadow-md hover:scale-[1.01] active:scale-[0.99]
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                cursor-pointer
              `}
              aria-label={`${lender.lenderName}: ${cfg.badge}. Rate ${formatRate(lender.rate)}%. Click for full analysis.`}
            >
              {/* Badge */}
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${cfg.badgeBg} px-2.5 py-1 rounded-full mb-3`}>
                <span role="img" aria-label={cfg.iconLabel}>{cfg.icon}</span>
                {cfg.badge}
              </span>

              {/* Lender name */}
              <p className="font-semibold text-gray-900 text-base mb-1">
                {lender.lenderName}
              </p>

              {/* Rate + APR */}
              <p className="text-sm text-gray-600 mb-3">
                <span className="font-bold text-lg text-gray-900">{formatRate(lender.rate)}%</span>
                <span className="ml-2 text-gray-400">APR {formatRate(lender.apr)}%</span>
              </p>

              {/* Key metrics */}
              <div className="space-y-1 text-sm">
                {lender.monthlySavings > 0 ? (
                  <p className="text-gray-700">
                    You&apos;d save <strong className="text-green-700">${formatDollars(lender.monthlySavings)}/mo</strong>
                  </p>
                ) : (
                  <p className="text-gray-500">
                    Payment increase: +${formatDollars(Math.abs(lender.monthlySavings))}/mo
                  </p>
                )}

                <p className="text-gray-500">
                  Break-even: {lender.breakEvenMonths !== null ? `${lender.breakEvenMonths} months` : "N/A"}
                </p>

                <p className="text-gray-500">
                  Total savings: {lender.totalSavings > 0
                    ? <strong className="text-gray-700">${formatDollars(lender.totalSavings)}</strong>
                    : `−$${formatDollars(Math.abs(lender.totalSavings))}`
                  }
                </p>
              </div>

              {/* Fees + points */}
              <p className="text-xs text-gray-400 mt-3">
                Fees: ${formatDollars(lender.fees)}
                {lender.points > 0 && ` · ${lender.points} pts`}
              </p>

              {/* CTA */}
              <p className="text-xs font-semibold text-blue-600 mt-3">
                See Full Analysis →
              </p>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 mt-3 text-center">
        Rates are estimates based on Freddie Mac data + lender spreads. Not a quote.
      </p>
    </section>
  );
}
