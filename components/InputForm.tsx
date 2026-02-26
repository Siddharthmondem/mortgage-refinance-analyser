"use client";

import { useState } from "react";
import type { RateData } from "@/lib/types";

export interface FormValues {
  remainingBalance: string;
  currentAnnualRate: string;
  yearsRemaining: string;
  closingCosts: string;
  creditTier: "excellent" | "good" | "fair";
  quotedRate: string;
}

export interface FormErrors {
  remainingBalance?: string;
  currentAnnualRate?: string;
  yearsRemaining?: string;
  closingCosts?: string;
  quotedRate?: string;
}

interface Props {
  rates: RateData;
  onSubmit: (values: FormValues) => void;
  initialValues?: Partial<FormValues>;
}

const CREDIT_TIER_OPTIONS = [
  { value: "excellent", label: "Excellent (740+ FICO)", spread30: 0, spread15: 0 },
  { value: "good",      label: "Good (670–739 FICO)",  spread30: 0.005, spread15: 0.004 },
  { value: "fair",      label: "Fair (620–669 FICO)",  spread30: 0.0125, spread15: 0.01 },
] as const;

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  const balance = parseFloat(values.remainingBalance.replace(/[$,]/g, ""));
  if (isNaN(balance) || balance < 10_000 || balance > 2_000_000) {
    errors.remainingBalance = "Enter a balance between $10,000 and $2,000,000";
  }

  const rate = parseFloat(values.currentAnnualRate.replace(/%/g, ""));
  if (isNaN(rate) || rate < 0.5 || rate > 15) {
    errors.currentAnnualRate = "Enter a rate between 0.5% and 15%";
  }

  const years = parseFloat(values.yearsRemaining);
  if (isNaN(years) || years < 1 || years > 30) {
    errors.yearsRemaining = "Enter years remaining between 1 and 30";
  }

  const costs = parseFloat(values.closingCosts.replace(/[$,]/g, ""));
  if (isNaN(costs) || costs < 0 || costs > 100_000) {
    errors.closingCosts = "Enter closing costs between $0 and $100,000";
  }

  if (values.quotedRate.trim() !== "") {
    const qr = parseFloat(values.quotedRate.replace(/%/g, ""));
    if (isNaN(qr) || qr < 0.5 || qr > 15) {
      errors.quotedRate = "Enter a rate between 0.5% and 15%";
    }
  }

  return errors;
}

export default function InputForm({ rates, onSubmit, initialValues }: Props) {
  const [values, setValues] = useState<FormValues>({
    remainingBalance: initialValues?.remainingBalance ?? "",
    currentAnnualRate: initialValues?.currentAnnualRate ?? "",
    yearsRemaining: initialValues?.yearsRemaining ?? "",
    closingCosts: initialValues?.closingCosts ?? "",
    creditTier: initialValues?.creditTier ?? "excellent",
    quotedRate: initialValues?.quotedRate ?? "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Auto-fill closing costs when balance changes
  function handleBalanceBlur() {
    setTouched((t) => ({ ...t, remainingBalance: true }));
    const balance = parseFloat(values.remainingBalance.replace(/[$,]/g, ""));
    if (!isNaN(balance) && values.closingCosts === "") {
      const defaultCosts = Math.round(balance * 0.02);
      setValues((v) => ({ ...v, closingCosts: defaultCosts.toString() }));
    }
    const errs = validate(values);
    setErrors((e) => ({ ...e, remainingBalance: errs.remainingBalance }));
  }

  function handleChange(field: keyof FormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (touched[field]) {
      const updated = { ...values, [field]: value };
      const errs = validate(updated);
      setErrors((e) => ({ ...e, [field]: errs[field as keyof FormErrors] }));
    }
  }

  function handleBlur(field: keyof FormValues) {
    setTouched((t) => ({ ...t, [field]: true }));
    const errs = validate(values);
    setErrors((e) => ({ ...e, [field]: errs[field as keyof FormErrors] }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(values);
    setErrors(errs);
    setTouched({ remainingBalance: true, currentAnnualRate: true, yearsRemaining: true, closingCosts: true, quotedRate: true });
    if (Object.keys(errs).length === 0) {
      onSubmit(values);
    }
  }

  const rateDate = new Date(rates.fetched_at).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  const inputClass = (err?: string) =>
    `w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      err ? "border-red-400 focus:ring-red-400" : "border-gray-300"
    }`;

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Loan details form" className="space-y-5">

      {/* Balance */}
      <div>
        <label htmlFor="field-balance" className="block text-sm font-medium text-gray-700 mb-1">
          Remaining loan balance
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium" aria-hidden="true">$</span>
          <input
            id="field-balance"
            type="text"
            inputMode="numeric"
            placeholder="320,000"
            value={values.remainingBalance}
            onChange={(e) => handleChange("remainingBalance", e.target.value)}
            onBlur={handleBalanceBlur}
            aria-invalid={!!errors.remainingBalance}
            aria-describedby={errors.remainingBalance ? "err-balance" : "hint-balance"}
            className={`${inputClass(errors.remainingBalance)} pl-7`}
          />
        </div>
        {errors.remainingBalance ? (
          <p id="err-balance" className="mt-1 text-xs text-red-600" role="alert">{errors.remainingBalance}</p>
        ) : (
          <p id="hint-balance" className="mt-1 text-xs text-gray-500">The amount you still owe — check your latest statement</p>
        )}
      </div>

      {/* Current Rate */}
      <div>
        <label htmlFor="field-rate" className="block text-sm font-medium text-gray-700 mb-1">
          Current interest rate
        </label>
        <div className="relative">
          <input
            id="field-rate"
            type="text"
            inputMode="decimal"
            placeholder="6.95"
            value={values.currentAnnualRate}
            onChange={(e) => handleChange("currentAnnualRate", e.target.value)}
            onBlur={() => handleBlur("currentAnnualRate")}
            aria-invalid={!!errors.currentAnnualRate}
            aria-describedby={errors.currentAnnualRate ? "err-rate" : "hint-rate"}
            className={`${inputClass(errors.currentAnnualRate)} pr-8`}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium" aria-hidden="true">%</span>
        </div>
        {errors.currentAnnualRate ? (
          <p id="err-rate" className="mt-1 text-xs text-red-600" role="alert">{errors.currentAnnualRate}</p>
        ) : (
          <p id="hint-rate" className="mt-1 text-xs text-gray-500">Your existing mortgage rate (not APR)</p>
        )}
      </div>

      {/* Years Remaining */}
      <div>
        <label htmlFor="field-years" className="block text-sm font-medium text-gray-700 mb-1">
          Years left on your loan
        </label>
        <input
          id="field-years"
          type="text"
          inputMode="numeric"
          placeholder="23"
          value={values.yearsRemaining}
          onChange={(e) => handleChange("yearsRemaining", e.target.value)}
          onBlur={() => handleBlur("yearsRemaining")}
          aria-invalid={!!errors.yearsRemaining}
          aria-describedby={errors.yearsRemaining ? "err-years" : "hint-years"}
          className={inputClass(errors.yearsRemaining)}
        />
        {errors.yearsRemaining ? (
          <p id="err-years" className="mt-1 text-xs text-red-600" role="alert">{errors.yearsRemaining}</p>
        ) : (
          <p id="hint-years" className="mt-1 text-xs text-gray-500">How many years until your current loan is paid off</p>
        )}
      </div>

      {/* Closing Costs */}
      <div>
        <label htmlFor="field-costs" className="block text-sm font-medium text-gray-700 mb-1">
          Estimated closing costs
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium" aria-hidden="true">$</span>
          <input
            id="field-costs"
            type="text"
            inputMode="numeric"
            placeholder="6,400"
            value={values.closingCosts}
            onChange={(e) => handleChange("closingCosts", e.target.value)}
            onBlur={() => handleBlur("closingCosts")}
            aria-invalid={!!errors.closingCosts}
            aria-describedby={errors.closingCosts ? "err-costs" : "hint-costs"}
            className={`${inputClass(errors.closingCosts)} pl-7`}
          />
        </div>
        {errors.closingCosts ? (
          <p id="err-costs" className="mt-1 text-xs text-red-600" role="alert">{errors.closingCosts}</p>
        ) : (
          <p id="hint-costs" className="mt-1 text-xs text-gray-500">
            Defaults to 2% of your balance. National average is 2–3%. Adjust if you have a quote.
          </p>
        )}
      </div>

      {/* Credit Tier */}
      <div>
        <label htmlFor="field-credit" className="block text-sm font-medium text-gray-700 mb-1">
          Your credit quality
        </label>
        <select
          id="field-credit"
          value={values.creditTier}
          onChange={(e) => handleChange("creditTier", e.target.value as FormValues["creditTier"])}
          aria-describedby="hint-credit"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {CREDIT_TIER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p id="hint-credit" className="mt-1 text-xs text-gray-500">Affects the rates we estimate for you</p>
      </div>

      {/* Optional: Quoted Rate */}
      <div>
        <label htmlFor="field-quoted" className="block text-sm font-medium text-gray-700 mb-1">
          Have a quoted rate?{" "}
          <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <div className="relative">
          <input
            id="field-quoted"
            type="text"
            inputMode="decimal"
            placeholder="Leave blank to use current market rates"
            value={values.quotedRate}
            onChange={(e) => handleChange("quotedRate", e.target.value)}
            onBlur={() => handleBlur("quotedRate")}
            aria-invalid={!!errors.quotedRate || undefined}
            aria-describedby={errors.quotedRate ? "err-quoted" : "hint-quoted"}
            className={`${inputClass(errors.quotedRate)} pr-8`}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium" aria-hidden="true">%</span>
        </div>
        {errors.quotedRate ? (
          <p id="err-quoted" className="mt-1 text-xs text-red-600" role="alert">{errors.quotedRate}</p>
        ) : (
          <p id="hint-quoted" className="mt-1 text-xs text-gray-500">
            If a lender gave you a specific rate, enter it here. Overrides market rates.
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Show Me the Math
      </button>

      {/* Trust + Source */}
      <div className="pt-1 space-y-1.5 text-center">
        <p className="text-xs text-gray-500">
          <span aria-hidden="true">🔒</span>{" "}
          Your numbers never leave your browser
        </p>
        <p className="text-xs text-gray-400">
          Using Freddie Mac PMMS rates as of {rateDate}
        </p>
      </div>
    </form>
  );
}
