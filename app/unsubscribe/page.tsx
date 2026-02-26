"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";

// ── Inner component (uses useSearchParams — must be inside Suspense) ──

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  type PageStatus = "processing" | "success" | "already" | "not_found" | "error";
  type ResubStatus = "idle" | "submitting" | "done" | "error";

  const [status, setStatus]       = useState<PageStatus>("processing");
  const [resubEmail, setResubEmail] = useState("");
  const [resubStatus, setResubStatus] = useState<ResubStatus>("idle");

  // Process unsubscribe on mount
  useEffect(() => {
    if (!token) {
      setStatus("not_found");
      return;
    }

    fetch("/api/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.ok) {
          setStatus("success");
        } else {
          const data = await res.json().catch(() => ({})) as { error?: string };
          setStatus(data.error === "Alert not found" ? "not_found" : "error");
        }
      })
      .catch(() => setStatus("error"));
  }, [token]);

  async function handleResubscribe(e: React.FormEvent) {
    e.preventDefault();
    setResubStatus("submitting");

    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resubEmail, resubscribe: true }),
      });

      setResubStatus(res.ok ? "done" : "error");
    } catch {
      setResubStatus("error");
    }
  }

  // ── Processing ──────────────────────────────────────────────
  if (status === "processing") {
    return (
      <Card>
        <p className="text-gray-400 text-sm animate-pulse">Processing…</p>
      </Card>
    );
  }

  // ── Success ─────────────────────────────────────────────────
  if (status === "success") {
    return (
      <Card>
        <div className="text-4xl mb-4" role="img" aria-label="Checkmark">✅</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">You&apos;ve been unsubscribed</h1>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          You won&apos;t receive any more rate alerts from us.<br />
          Your loan data was never stored on our servers.
        </p>

        {resubStatus === "done" ? (
          <p className="text-sm text-green-700 font-medium">
            ✅ You&apos;re back on the list. We&apos;ll alert you when rates hit your target.
          </p>
        ) : (
          <div className="border-t border-gray-100 pt-6 text-left">
            <p className="text-xs text-gray-400 mb-3 text-center">Changed your mind?</p>
            <form onSubmit={handleResubscribe} className="flex gap-2" noValidate>
              <label htmlFor="resub-email" className="sr-only">Email address to resubscribe</label>
              <input
                id="resub-email"
                type="email"
                inputMode="email"
                placeholder="your@email.com"
                value={resubEmail}
                onChange={(e) => setResubEmail(e.target.value)}
                disabled={resubStatus === "submitting"}
                required
                className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={resubStatus === "submitting"}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 whitespace-nowrap"
              >
                {resubStatus === "submitting" ? "…" : "Re-subscribe"}
              </button>
            </form>
            {resubStatus === "error" && (
              <p className="mt-2 text-xs text-red-600" role="alert">
                Something went wrong — try again or{" "}
                <Link href="/" className="underline">use the calculator</Link>{" "}
                to set up a new alert.
              </p>
            )}
          </div>
        )}

        <div className="mt-8">
          <Link
            href="/"
            className="text-xs text-blue-600 hover:text-blue-800 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          >
            ← Back to Refinance Clarity Engine
          </Link>
        </div>
      </Card>
    );
  }

  // ── Not found ───────────────────────────────────────────────
  if (status === "not_found") {
    return (
      <Card>
        <div className="text-4xl mb-4" role="img" aria-label="Warning">⚠️</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Link not recognised</h1>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          This unsubscribe link may have already been used, or the alert no longer exists.
          If you&apos;re still receiving emails, please contact us.
        </p>
        <Link
          href="/"
          className="text-xs text-blue-600 hover:text-blue-800 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        >
          ← Back to Refinance Clarity Engine
        </Link>
      </Card>
    );
  }

  // ── Error ───────────────────────────────────────────────────
  return (
    <Card>
      <div className="text-4xl mb-4" role="img" aria-label="Error">❌</div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h1>
      <p className="text-sm text-gray-500 mb-6">
        We couldn&apos;t process your request. Please try again later.
      </p>
      <Link
        href="/"
        className="text-xs text-blue-600 hover:text-blue-800 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
      >
        ← Back to Refinance Clarity Engine
      </Link>
    </Card>
  );
}

// ── Shared card wrapper ───────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-16">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
        {children}
      </div>
      <p className="mt-6 text-xs text-gray-400">
        Refinance Clarity Engine — educational tool only, not financial advice
      </p>
    </div>
  );
}

// ── Page export (Suspense required for useSearchParams) ───────

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p className="text-gray-400 text-sm">Loading…</p>
        </div>
      }
    >
      <UnsubscribeContent />
    </Suspense>
  );
}
