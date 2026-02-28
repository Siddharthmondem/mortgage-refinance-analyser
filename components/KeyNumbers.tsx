"use client";

import type { Verdict } from "@/lib/types";

interface Props {
  verdict: Verdict;
  horizonYears: number;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtIRR(irr: number | null): string {
  if (irr === null) return "N/A";
  if (!isFinite(irr)) return "∞";
  const pct = (irr * 100).toFixed(1);
  return irr >= 0 ? `+${pct}%` : `${pct}%`;
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
  const horizonMonths = horizonYears * 12;

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

  // Accent thresholds scale with horizon (mirrors determineColor in comparison.ts)
  const greenSavingsThreshold = 200 * horizonYears;
  const breakEvenRatio =
    verdict.breakEvenMonths !== null && horizonMonths > 0
      ? verdict.breakEvenMonths / horizonMonths
      : null;

  const irrDisplay = fmtIRR(verdict.irrAnnualized);
  const irrIsPositive =
    verdict.irrAnnualized !== null &&
    isFinite(verdict.irrAnnualized) &&
    verdict.irrAnnualized > 0;
  const irrIsNegative =
    verdict.irrAnnualized !== null &&
    isFinite(verdict.irrAnnualized) &&
    verdict.irrAnnualized < 0;

  return (
    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3" aria-label="Key refinance numbers">
      <Card
        value={breakEvenDisplay}
        label="break-even"
        sub="to recoup costs"
        accent={
          breakEvenRatio !== null &&
          breakEvenRatio < 0.33 &&
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
        accent={verdict.netSavings > greenSavingsThreshold}
        warn={verdict.netSavings < 0}
      />
      <Card
        value={irrDisplay}
        label="annual return"
        sub="on closing costs"
        accent={irrIsPositive && verdict.irrAnnualized! > 0.10}
        warn={irrIsNegative}
      />
    </dl>
  );
}
