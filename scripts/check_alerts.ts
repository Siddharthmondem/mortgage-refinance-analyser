#!/usr/bin/env node
// ============================================================
// Check stored rate alerts against current PMMS rates.
// Sends email via Resend when trigger threshold is met.
// Run weekly after rates update: npx tsx scripts/check_alerts.ts
//
// Required env vars:
//   RESEND_API_KEY   — Resend API key (omit to run in dry-run mode)
//   BASE_URL         — Production URL (default: http://localhost:3002)
//   FROM_EMAIL       — Sender address (must be verified in Resend)
// ============================================================

import fs from "fs";
import path from "path";

interface RateAlert {
  id: string;
  email: string;
  trigger_rate: number;
  loan_params_hash: string;
  created_at: string;
  notified_at?: string;
  unsubscribed: boolean;
}

interface RateData {
  source: "freddie_mac_pmms";
  fetched_at: string;
  rates: { fixed_30yr: number; fixed_15yr: number };
}

const ALERTS_FILE = path.resolve(process.cwd(), "data/rate-alerts.json");
const RATES_FILE  = path.resolve(process.cwd(), "data/rates.json");

const BASE_URL      = process.env.BASE_URL   || "http://localhost:3002";
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL    = process.env.FROM_EMAIL || "alerts@refinanceclarityengine.com";

// ── Data helpers ──────────────────────────────────────────────

function loadAlerts(): RateAlert[] {
  try {
    return JSON.parse(fs.readFileSync(ALERTS_FILE, "utf-8")) as RateAlert[];
  } catch {
    return [];
  }
}

function saveAlerts(alerts: RateAlert[]): void {
  fs.mkdirSync(path.dirname(ALERTS_FILE), { recursive: true });
  fs.writeFileSync(ALERTS_FILE, JSON.stringify(alerts, null, 2) + "\n");
}

function loadRates(): RateData {
  const raw = fs.readFileSync(RATES_FILE, "utf-8");
  return JSON.parse(raw) as RateData;
}

// ── Email ─────────────────────────────────────────────────────

function buildEmailHtml(
  alertId: string,
  triggerRate: number,
  currentRate: number,
): string {
  const triggerDisplay = (triggerRate * 100).toFixed(2);
  const currentDisplay = (currentRate * 100).toFixed(2);
  const unsubUrl = `${BASE_URL}/unsubscribe?token=${alertId}`;
  const calcUrl  = BASE_URL;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">

    <!-- Header -->
    <div style="background:#f0fdf4;border-bottom:1px solid #bbf7d0;padding:24px 32px;">
      <p style="margin:0;font-size:28px;">📉</p>
      <h1 style="margin:8px 0 4px;font-size:20px;font-weight:700;color:#15803d;">
        Rates dropped to your target
      </h1>
      <p style="margin:0;font-size:14px;color:#166534;">
        30-year rates are now at <strong>${currentDisplay}%</strong>
      </p>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
        The national 30-year fixed mortgage rate has dropped to
        <strong style="color:#111827;">${currentDisplay}%</strong> —
        at or below your alert threshold of
        <strong style="color:#111827;">${triggerDisplay}%</strong>.
      </p>
      <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
        Based on your loan details, this is the point where refinancing
        could start saving you money. Run a fresh calculation to confirm.
      </p>

      <a href="${calcUrl}"
         style="display:inline-block;background:#2563eb;color:#fff;padding:13px 28px;
                border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
        Check My Numbers →
      </a>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;border-top:1px solid #f3f4f6;background:#f9fafb;">
      <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
        This is a one-time rate alert from
        <strong style="color:#6b7280;">Refinance Clarity Engine</strong>.
        No lender relationships. No affiliate fees. No spam.
      </p>
      <p style="margin:8px 0 0;font-size:12px;">
        <a href="${unsubUrl}" style="color:#9ca3af;text-decoration:underline;">
          Unsubscribe from rate alerts
        </a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

async function sendEmail(
  alert: RateAlert,
  currentRate: number,
): Promise<boolean> {
  const triggerDisplay = (alert.trigger_rate * 100).toFixed(2);
  const currentDisplay = (currentRate * 100).toFixed(2);
  const subject = `Mortgage rates hit ${currentDisplay}% — your refinance alert triggered`;

  // ── Dry-run mode (no API key) ──────────────────────────────
  if (!RESEND_API_KEY) {
    console.log(
      `  [DRY RUN] Would email ${alert.email}` +
      ` | current ${currentDisplay}% <= trigger ${triggerDisplay}%`
    );
    return true;
  }

  // ── Live send via Resend ───────────────────────────────────
  const html = buildEmailHtml(alert.id, alert.trigger_rate, currentRate);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: alert.email,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(no body)");
    console.error(`  ❌ Resend error for ${alert.email}: ${res.status} ${body}`);
    return false;
  }

  return true;
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  // Load current rates
  let rates: RateData;
  try {
    rates = loadRates();
  } catch {
    console.error("❌ Could not load data/rates.json — run fetch_rates.ts first.");
    process.exit(1);
  }

  const currentRate30yr = rates.rates.fixed_30yr / 100;
  const ratesAge = Math.round(
    (Date.now() - new Date(rates.fetched_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  console.log(`\n📊 Current 30yr rate : ${(currentRate30yr * 100).toFixed(2)}%`);
  console.log(`   Rate data age      : ${ratesAge} day(s) (fetched ${rates.fetched_at})`);

  if (ratesAge > 10) {
    console.warn(`⚠️  Rate data is ${ratesAge} days old — consider running fetch_rates.ts first.`);
  }

  // Load alerts
  const alerts = loadAlerts();
  console.log(`\n📋 Total alerts      : ${alerts.length}`);

  const active    = alerts.filter((a) => !a.unsubscribed && !a.notified_at);
  const eligible  = active.filter((a) => currentRate30yr <= a.trigger_rate);

  console.log(`   Active (unsent)   : ${active.length}`);
  console.log(`   Eligible today    : ${eligible.length}`);

  if (!RESEND_API_KEY) {
    console.log("\n⚠️  RESEND_API_KEY not set — running in dry-run mode.\n");
  }

  if (eligible.length === 0) {
    console.log("\n✅ No alerts to send. Done.\n");
    return;
  }

  console.log("\nSending alerts...");

  let sent   = 0;
  let failed = 0;

  for (const alert of eligible) {
    const triggerDisplay  = (alert.trigger_rate * 100).toFixed(2);
    const currentDisplay  = (currentRate30yr * 100).toFixed(2);

    console.log(
      `  → ${alert.email} | trigger ${triggerDisplay}% | current ${currentDisplay}%`
    );

    const ok = await sendEmail(alert, currentRate30yr);

    if (ok) {
      alert.notified_at = new Date().toISOString();
      sent++;
      console.log(`     ✅ Sent`);
    } else {
      failed++;
    }

    // Small delay to stay within Resend rate limits
    await new Promise((r) => setTimeout(r, 250));
  }

  // Persist updated notified_at timestamps
  saveAlerts(alerts);

  console.log(`\n✅ Done — sent: ${sent}, failed: ${failed}\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
