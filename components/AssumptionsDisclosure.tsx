import type { RateData } from "@/lib/types";

interface Props {
  rates: RateData;
}

export default function AssumptionsDisclosure({ rates }: Props) {
  const rateDate = new Date(rates.fetched_at).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div className="text-xs text-gray-500 space-y-1.5 border-t border-gray-200 pt-4 mt-4">
      <p className="font-semibold text-gray-600">Assumptions & Limitations</p>
      <ul className="space-y-1 list-disc list-inside">
        <li>
          Rates are national averages from Freddie Mac PMMS (last updated {rateDate})
        </li>
        <li>Fixed-rate loans only. ARMs, HELOCs, and cash-out refinance not included.</li>
        <li>
          Closing costs default to 2% of loan balance. Your actual costs may vary.
        </li>
        <li>
          Calculations exclude property taxes, homeowner&apos;s insurance, PMI, and escrow.
        </li>
        <li>
          Credit tier adjustments are estimates. Your actual rate depends on full underwriting.
        </li>
        <li>
          This tool provides estimates for educational purposes only. It is not financial advice.
          Consult a licensed mortgage professional before making decisions.
        </li>
      </ul>
    </div>
  );
}
