"use client";

interface Option {
  label: string;
  value: number | null; // null = full remaining term
}

interface Props {
  /** Currently selected horizon in months (null = full term) */
  value: number | null;
  onChange: (v: number | null) => void;
  /** User's years remaining — used to label the "Full" option and hide options that exceed it */
  yearsRemaining: number;
}

const HORIZON_OPTIONS: Array<{ label: string; months: number }> = [
  { label: "3yr",  months: 36  },
  { label: "5yr",  months: 60  },
  { label: "7yr",  months: 84  },
  { label: "10yr", months: 120 },
];

export default function HorizonSelector({ value, onChange, yearsRemaining }: Props) {
  const fullMonths = Math.round(yearsRemaining * 12);
  const fullYears  = Math.round(yearsRemaining);

  // Build visible options: only those shorter than the remaining term
  const options: Option[] = [
    ...HORIZON_OPTIONS
      .filter((o) => o.months < fullMonths)
      .map((o) => ({ label: o.label, value: o.months })),
    { label: `Full (${fullYears}yr)`, value: null },
  ];

  return (
    <div
      className="flex items-center gap-2 flex-wrap"
      role="group"
      aria-label="Comparison horizon"
    >
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
        Horizon:
      </span>
      <div className="flex gap-1 flex-wrap">
        {options.map((opt) => {
          const isActive = opt.value === value;
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              aria-pressed={isActive}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
