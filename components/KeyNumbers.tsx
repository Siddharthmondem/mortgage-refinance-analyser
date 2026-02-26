"use client";

import type { Verdict } from "@/lib/types";

interface Props {
  verdict: Verdict;
  horizonYears: number;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

interface CardProps {
  value: string;
  label: string;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
}

function Card({ value, label, sub, accent, warn }: CardProps) {
  return (
    <div
      className={`rounded-xl p-2.5 sm:p-4 text-center border transition-colors ${
        accent
          ? "bg-blue-50 border-blue-200"
          : warn
          ? "bg-amber-50 border-amber-200"
          : "bg-white border-gray-200"
      }`}
    >
      <dt className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide leading-tight">
        {label}
      </dt>
      <dd
        className={`text-base sm:text-2xl font-bold leading-tight break-words mt-0.5 ${
          accent ? "text-blue-700" : warn ? "text-amber-700" : "text-gray-900"
        }`}
      >
        {value}
      </dd>
      {sub && <p className="hidden sm:block text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function KeyNumbers({ verdict, horizonYears }: Props) {
  const breakEvenDisplay =
    verdict.breakEvenMonths === null
      ? "N/A"
      : verdict.breakEvenMonths === 0
      ? "Immediate"
      : `${verdict.breakEvenMonths} mo`;

  const monthlyAbs = Math.abs(verdict.monthlyDelta).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const monthlySign = verdict.monthlyDelta < 0 ? "-" : verdict.monthlyDelta > 0 ? "+" : "";
  const monthlyDisplay = verdict.monthlyDelta === 0 ? "No change" : `${monthlySign}$${monthlyAbs}/mo`;
  const monthlyLabel = verdict.monthlyDelta < 0 ? "monthly savings" : verdict.monthlyDelta > 0 ? "monthly increase" : "monthly payment";

  const savingsAbs = Math.abs(verdict.netSavings);
  const savingsDisplay =
    verdict.netSavings > 0
      ? `$${fmt(savingsAbs)} saved`
      : verdict.netSavings < 0
      ? `$${fmt(savingsAbs)} more`
      : "No change";

  return (
    <dl className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Key refinance numbers">
      <Card
        value={breakEvenDisplay}
        label="break-even"
        sub="to recoup costs"
        accent={
          verdict.breakEvenMonths !== null &&
          verdict.breakEvenMonths < 24 &&
          verdict.color === "green"
        }
      />
      <Card
        value={monthlyDisplay}
        label={monthlyLabel}
        sub="vs. current payment"
        warn={verdict.monthlyDelta > 0}
      />
      <Card
        value={savingsDisplay}
        label={`over ${horizonYears} years`}
        sub="total cost difference"
        accent={verdict.netSavings > 2000}
        warn={verdict.netSavings < 0}
      />
    </dl>
  );
}
