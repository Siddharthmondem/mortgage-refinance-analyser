"use client";

import type { Verdict } from "@/lib/types";

interface Props {
  verdict: Verdict;
}

const CONFIG = {
  green: {
    bg: "bg-green-50",
    border: "border-green-200",
    icon: "✅",
    iconLabel: "Positive verdict",
    labelColor: "text-green-800",
    messageColor: "text-green-700",
  },
  yellow: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: "⚠️",
    iconLabel: "Caution verdict",
    labelColor: "text-amber-800",
    messageColor: "text-amber-700",
  },
  red: {
    bg: "bg-red-50",
    border: "border-red-200",
    icon: "❌",
    iconLabel: "Negative verdict",
    labelColor: "text-red-800",
    messageColor: "text-red-700",
  },
} as const;

export default function VerdictBox({ verdict }: Props) {
  const cfg = CONFIG[verdict.color];

  return (
    <div
      className={`rounded-xl border-2 ${cfg.bg} ${cfg.border} p-6`}
      role="region"
      aria-label="Refinance verdict"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl" role="img" aria-label={cfg.iconLabel}>
          {cfg.icon}
        </span>
        <h2 className={`text-xl font-bold ${cfg.labelColor}`}>
          {verdict.label}
        </h2>
      </div>

      {/* Message */}
      <p className={`text-sm leading-relaxed ${cfg.messageColor}`}>
        {verdict.message}
      </p>
    </div>
  );
}
