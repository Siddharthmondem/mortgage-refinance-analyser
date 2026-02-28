"use client";

import { useState } from "react";

interface Props {
  interestBreakEvenMonths: number | null;
  cashflowBreakEvenMonths: number | null;
  horizonMonths: number;
}

/**
 * Displays the break-even value for a scenario cell in the comparison table.
 *
 * Primary display (interestBreakEvenMonths):
 *   1. null               → "—"
 *   2. > horizonMonths    → "After horizon"
 *   3. 0                  → "Immediate"
 *   4. otherwise          → "{n} mo"
 *
 * Tooltip always shows both types.
 */
export default function BreakEvenDisplay({
  interestBreakEvenMonths,
  cashflowBreakEvenMonths,
  horizonMonths,
}: Props) {
  const [showTip, setShowTip] = useState(false);

  // ---- Primary display ----
  let primary: string;
  let isAfterHorizon = false;

  if (interestBreakEvenMonths === null) {
    primary = "—";
  } else if (interestBreakEvenMonths > horizonMonths) {
    primary = "After horizon";
    isAfterHorizon = true;
  } else if (interestBreakEvenMonths === 0) {
    primary = "Immediate";
  } else {
    primary = `${interestBreakEvenMonths} mo`;
  }

  // ---- Tooltip labels ----
  const interestLabel =
    interestBreakEvenMonths === null
      ? "Not reached"
      : interestBreakEvenMonths > horizonMonths
      ? `${interestBreakEvenMonths} mo (after horizon)`
      : interestBreakEvenMonths === 0
      ? "Immediate"
      : `${interestBreakEvenMonths} mo`;

  const cashflowLabel =
    cashflowBreakEvenMonths === null
      ? "Never"
      : cashflowBreakEvenMonths === 0
      ? "Immediate"
      : `${cashflowBreakEvenMonths} mo`;

  return (
    <span className="relative inline-block">
      <button
        type="button"
        className={`text-sm cursor-help underline decoration-dashed underline-offset-2 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded ${
          isAfterHorizon ? "text-amber-700" : "text-gray-900"
        }`}
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        onFocus={() => setShowTip(true)}
        onBlur={() => setShowTip(false)}
        aria-describedby="be-tooltip"
      >
        {primary}
      </button>

      {showTip && (
        <div
          id="be-tooltip"
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 w-52 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none"
        >
          <p className="font-semibold mb-1">Break-even detail</p>
          <div className="space-y-0.5">
            <div className="flex justify-between gap-2">
              <span className="text-gray-300">Interest savings:</span>
              <span className="font-medium">{interestLabel}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-gray-300">Cashflow savings:</span>
              <span className="font-medium">{cashflowLabel}</span>
            </div>
          </div>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </span>
  );
}
