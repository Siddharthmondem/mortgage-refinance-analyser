import { NextRequest, NextResponse } from "next/server";
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

// POST /api/unsubscribe
// Body: { token: string }                  → unsubscribe by alert ID
//       { email: string, resubscribe: true } → re-enable an alert by email
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json() as {
      token?: string;
      email?: string;
      resubscribe?: boolean;
    };
    const { token, email, resubscribe } = body;

    if (!token && !email) {
      return NextResponse.json({ error: "token or email required" }, { status: 400 });
    }

    const alerts = loadAlerts();
    let alert: RateAlert | undefined;

    if (token) {
      // Unsubscribe by alert ID (from email link)
      alert = alerts.find((a) => a.id === token);
    } else if (email) {
      // Resubscribe by email address
      const normalized = email.toLowerCase().trim();
      // Find the most recently created alert for this email
      alert = alerts
        .filter((a) => a.email === normalized)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    }

    if (!alert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    if (resubscribe) {
      alert.unsubscribed = false;
      delete alert.notified_at; // allow re-notification
    } else {
      alert.unsubscribed = true;
    }

    saveAlerts(alerts);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("unsubscribe error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
