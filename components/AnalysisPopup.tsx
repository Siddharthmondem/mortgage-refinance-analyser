"use client";

import { useEffect, useRef, useCallback } from "react";
import VerdictBox from "./VerdictBox";
import KeyNumbers from "./KeyNumbers";
import ScenarioTable from "./ScenarioTable";
import type { ScoredLenderRate } from "@/lib/types";

interface Props {
  lender: ScoredLenderRate;
  onClose: () => void;
}

function formatDollars(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatRate(decimal: number): string {
  return (decimal * 100).toFixed(2);
}

export default function AnalysisPopup({ lender, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus trap + Escape to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      // Focus trap within dialog
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    // Focus close button on mount
    closeRef.current?.focus();
    // Prevent body scroll
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  const { verdict, engineOutput } = lender;
  const horizonYears = Math.round(engineOutput.horizonMonths / 12);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-4 sm:pt-8 px-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Analysis for ${lender.lenderName}`}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex items-start justify-between rounded-t-2xl">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">
              {lender.lenderName}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {formatRate(lender.rate)}% rate · APR {formatRate(lender.apr)}% · Fees ${formatDollars(lender.fees)}
              {lender.points > 0 && ` · ${lender.points} pts`}
            </p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl p-1 -mr-1 -mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            aria-label="Close analysis"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-3">
          {/* Verdict */}
          <VerdictBox verdict={verdict} showRecommendation compact />

          {/* Key Numbers */}
          <KeyNumbers verdict={verdict} horizonYears={horizonYears} />

          {/* Scenario Table (collapsible) */}
          <ScenarioTable
            scenarios={engineOutput.scenarios}
            horizonYears={horizonYears}
            horizonMonths={engineOutput.horizonMonths}
          />
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 rounded-b-2xl">
          <button
            onClick={onClose}
            className="text-sm text-blue-600 hover:text-blue-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          >
            ← Try Another Lender
          </button>
        </div>
      </div>
    </div>
  );
}
