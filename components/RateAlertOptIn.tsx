"use client";

import { useState } from "react";

interface Props {
  triggerRate: number; // the rate at which verdict flips green
  currentRate: number; // user's current loan rate
}

type Status = "idle" | "submitting" | "success" | "error";

export default function RateAlertOptIn({ triggerRate, currentRate }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const triggerDisplay = (triggerRate * 100).toFixed(2);

  function validateEmail(v: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!validateEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setStatus("submitting");

    try {
      const res = await fetch("/api/rate-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, triggerRate, currentRate }),
      });

      if (!res.ok) throw new Error("Server error");
      setStatus("success");
    } catch {
      setStatus("error");
      setError("Something went wrong. Try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-center">
        <p className="text-2xl mb-2">🔔</p>
        <p className="font-semibold text-blue-800 text-sm">You&apos;re on the list.</p>
        <p className="text-xs text-blue-700 mt-1">
          We&apos;ll email you when 30-year rates drop to{" "}
          <strong>{triggerDisplay}%</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="text-xl mt-0.5" aria-hidden>🔔</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm">
            Get notified when rates make refinancing worthwhile
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            We&apos;ll alert you when 30-year rates drop to{" "}
            <strong className="text-gray-700">{triggerDisplay}%</strong> — the
            point where refinancing starts saving you money.
          </p>

          <form onSubmit={handleSubmit} className="mt-3 flex gap-2" noValidate>
            <label htmlFor="rate-alert-email" className="sr-only">
              Email address for rate alert
            </label>
            <input
              id="rate-alert-email"
              type="email"
              inputMode="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === "submitting"}
              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={status === "submitting"}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 whitespace-nowrap"
            >
              {status === "submitting" ? "Saving…" : "Notify Me"}
            </button>
          </form>

          {error && (
            <p className="mt-1.5 text-xs text-red-600" role="alert">
              {error}
            </p>
          )}
          {status === "error" && !error && (
            <p className="mt-1.5 text-xs text-red-600" role="alert">
              Something went wrong. Try again.
            </p>
          )}

          <p className="mt-2 text-xs text-gray-400">
            Rate alerts only. No spam. Unsubscribe anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
