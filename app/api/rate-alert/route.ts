import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";

interface RateAlert {
  id: string;
  email: string;
  trigger_rate: number;
  loan_params_hash: string;
  created_at: string;
  notified_at?: string;
  unsubscribed: boolean;
}

const ALERTS_FILE = path.resolve(process.cwd(), "data/rate-alerts.json");

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

function hashEmail(email: string): string {
  return crypto.createHash("sha256").update(email.toLowerCase().trim()).digest("hex").slice(0, 12);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json() as { email?: string; triggerRate?: number; currentRate?: number };
    const { email, triggerRate, currentRate } = body;

    // Validate
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    if (typeof triggerRate !== "number" || triggerRate <= 0 || triggerRate > 0.15) {
      return NextResponse.json({ error: "Invalid trigger rate" }, { status: 400 });
    }
    if (typeof currentRate !== "number" || currentRate <= 0) {
      return NextResponse.json({ error: "Invalid current rate" }, { status: 400 });
    }

    // Load existing, check for duplicate
    const alerts = loadAlerts();
    const normalizedEmail = email.toLowerCase().trim();
    const existing = alerts.find(
      (a) => hashEmail(a.email) === hashEmail(normalizedEmail) && !a.unsubscribed
    );

    if (existing) {
      // Update trigger rate if it changed
      existing.trigger_rate = triggerRate;
      saveAlerts(alerts);
      return NextResponse.json({ ok: true, updated: true });
    }

    // Create new alert
    const alert: RateAlert = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      trigger_rate: triggerRate,
      loan_params_hash: hashEmail(normalizedEmail + triggerRate.toFixed(4)),
      created_at: new Date().toISOString(),
      unsubscribed: false,
    };

    alerts.push(alert);
    saveAlerts(alerts);

    return NextResponse.json({ ok: true, created: true });
  } catch (err) {
    console.error("rate-alert error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
