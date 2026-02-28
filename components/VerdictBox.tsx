"use client";

import type { Verdict, ScenarioId } from "@/lib/types";

const SCENARIO_LABELS: Record<ScenarioId, string> = {
  stay_current: "",
  refi_same_term: "Same-Term Refinance",
  refi_15yr: "15-Year Refinance",
  refi_30yr: "30-Year Refinance",
};

interface Props {
  verdict: Verdict;
  /** When true, appends the recommended scenario name to the verdict label */
  showRecommendation?: boolean;
  /** When true, reduces padding and hides the message paragraph (for modal/popup contexts) */
  compact?: boolean;
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

export default function VerdictBox({ verdict, showRecommendation, compact }: Props) {
  const cfg = CONFIG[verdict.color];
  const scenarioLabel = SCENARIO_LABELS[verdict.bestScenarioId];
  const showScenario = showRecommendation && scenarioLabel;

  return (
    <div
      className={`rounded-xl border-2 ${cfg.bg} ${cfg.border} ${compact ? "p-4" : "p-6"}`}
      role="region"
      aria-label="Refinance verdict"
    >
      {/* Header */}
      <div className={`flex items-start gap-3 ${compact ? "" : "mb-3"}`}>
        <span className="text-2xl flex-shrink-0" role="img" aria-label={cfg.iconLabel}>
          {cfg.icon}
        </span>
        <div>
          <h2 className={`text-xl font-bold ${cfg.labelColor}`}>
            {verdict.label}
          </h2>
          {showScenario && (
            <p className={`text-sm font-semibold ${cfg.labelColor} opacity-80 mt-0.5`}>
              Recommended: {scenarioLabel}
            </p>
          )}
        </div>
      </div>

      {/* Message — hidden in compact mode; numbers tell the story */}
      {!compact && (
        <p className={`text-sm leading-relaxed ${cfg.messageColor}`}>
          {verdict.message}
        </p>
      )}
    </div>
  );
}
