import { NextResponse } from "next/server";
import { getLatestRates, ageDescription } from "@/lib/pmms";
import type { RateData, MarketRatesResponse } from "@/lib/types";

import ratesJson from "@/data/rates.json";
const FALLBACK = ratesJson as RateData;

export async function GET(): Promise<Response> {
  const { rates, source } = await getLatestRates(FALLBACK);

  const response: MarketRatesResponse = {
    rates,
    rateSource: source,
    ageDescription: ageDescription(rates.fetched_at),
  };

  return NextResponse.json(response, {
    headers: {
      // Allow CDN / browser caching for 10 minutes
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
