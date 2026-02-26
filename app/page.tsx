import JsonLd from "@/components/JsonLd";
import HomeClient from "./HomeClient";

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "When should I refinance my mortgage?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Refinancing typically makes sense when you can lower your interest rate by at least 0.5%, your break-even period (closing costs ÷ monthly savings) is under 24 months, and you plan to stay in your home past the break-even point. Use our calculator to get a precise answer for your situation.",
      },
    },
    {
      "@type": "Question",
      name: "What is the break-even period for refinancing?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The break-even period is how many months it takes for your monthly savings to cover the upfront closing costs. For example, if refinancing costs $6,000 and saves you $300/month, your break-even is 20 months. If you sell or move before then, you lose money on the refinance.",
      },
    },
    {
      "@type": "Question",
      name: "How much does it cost to refinance a mortgage?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Closing costs for a mortgage refinance typically range from 2% to 3% of the loan balance. On a $300,000 loan, that's $6,000–$9,000. Costs include lender fees, appraisal, title insurance, and prepaid interest. Some lenders offer 'no-closing-cost' refinances, but these roll costs into the rate or balance.",
      },
    },
    {
      "@type": "Question",
      name: "What is the 'term reset trap' in refinancing?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The term reset trap occurs when you refinance into a 30-year mortgage after already paying down your current loan for several years. Even at a lower rate, you reset to 30 years of payments, meaning you'll pay more total interest over your lifetime — and still owe money long after your original loan would have been paid off.",
      },
    },
    {
      "@type": "Question",
      name: "Should I refinance to a 15-year or 30-year mortgage?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A 15-year mortgage offers a lower interest rate and eliminates debt faster, but requires a higher monthly payment. A 30-year refinance lowers your payment but costs more in total interest. Our calculator compares both options against your current loan so you can see the exact trade-offs with your numbers.",
      },
    },
    {
      "@type": "Question",
      name: "How do I know if refinancing is worth it?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Compare the total cost of your current loan (remaining interest) against the total cost of each refinance option (interest + closing costs) over the same time horizon. Refinancing is worth it if the best scenario saves you money overall and the break-even period is shorter than how long you plan to stay in the home.",
      },
    },
  ],
};

export default function Page() {
  return (
    <>
      <JsonLd data={FAQ_SCHEMA} />
      <HomeClient />
    </>
  );
}
