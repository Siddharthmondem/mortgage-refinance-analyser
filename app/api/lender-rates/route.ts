import { NextResponse } from "next/server";
import { generateSyntheticRates } from "@/lib/lender-rates";
import type { CreditTier, LenderRate } from "@/lib/types";

import ratesJson from "@/data/rates.json";

// ---- Simple in-memory cache (1 hour) ----
const cache = new Map<string, { data: LenderRate[]; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface RequestBody {
  loanAmount: number;
  propertyValue?: number;
  creditTier: CreditTier;
  zipCode?: string;
}

export async function POST(req: Request): Promise<Response> {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { loanAmount, creditTier } = body;

  if (!loanAmount || loanAmount < 10_000 || loanAmount > 2_000_000) {
    return NextResponse.json(
      { error: "loanAmount must be between 10,000 and 2,000,000" },
      { status: 400 }
    );
  }

  const validTiers: CreditTier[] = ["excellent", "good", "fair"];
  if (!validTiers.includes(creditTier)) {
    return NextResponse.json(
      { error: "creditTier must be excellent, good, or fair" },
      { status: 400 }
    );
  }

  // Cache key based on loan params
  const cacheKey = `${loanAmount}-${creditTier}-${body.zipCode ?? "nat"}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ rates: cached.data, source: "cache" });
  }

  // Try Zillow API if partner ID is configured
  const partnerId = process.env.ZILLOW_PARTNER_ID;
  if (partnerId) {
    try {
      const rates = await fetchZillowRates(body, partnerId);
      if (rates.length > 0) {
        cache.set(cacheKey, { data: rates, timestamp: Date.now() });
        return NextResponse.json({ rates, source: "zillow" });
      }
    } catch {
      // Fall through to synthetic
    }
  }

  // Fallback: synthetic rates from PMMS
  const rates = generateSyntheticRates(
    ratesJson.rates.fixed_30yr,
    ratesJson.rates.fixed_15yr,
    creditTier,
    loanAmount
  );

  cache.set(cacheKey, { data: rates, timestamp: Date.now() });
  return NextResponse.json({ rates, source: "synthetic" });
}

async function fetchZillowRates(
  params: RequestBody,
  partnerId: string
): Promise<LenderRate[]> {
  const url = new URL("https://mortgageapi.zillow.com/getCurrentRates");
  url.searchParams.set("partnerId", partnerId);
  url.searchParams.set("loanAmount", String(params.loanAmount));
  if (params.propertyValue) {
    url.searchParams.set("propertyValue", String(params.propertyValue));
  }
  if (params.zipCode) {
    url.searchParams.set("zipCode", params.zipCode);
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) return [];

  const data = await res.json();

  // Map Zillow response to our LenderRate format
  // Zillow structure varies — this is a best-effort mapping
  if (!data || !Array.isArray(data.rates)) return [];

  return (data.rates as Array<Record<string, unknown>>)
    .slice(0, 8)
    .map((r, idx) => ({
      id: `zillow-${idx}`,
      lenderName: String(r.lenderName ?? r.name ?? `Lender ${idx + 1}`),
      rate: Number(r.rate ?? 0) / 100,
      apr: Number(r.apr ?? r.rate ?? 0) / 100,
      monthlyPayment: Number(r.monthlyPayment ?? 0),
      fees: Number(r.fees ?? r.closingCosts ?? 0),
      points: Number(r.points ?? 0),
      loanProgram: String(r.loanProgram ?? r.program ?? "30yr Fixed"),
      lastUpdated: new Date().toISOString(),
    }));
}
