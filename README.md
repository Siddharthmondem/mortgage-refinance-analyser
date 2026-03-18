# Mortgage Refinance Analyser

A deterministic mortgage refinance comparison engine built with Next.js. Helps homeowners evaluate whether refinancing makes financial sense by computing break-even timelines, amortization schedules, and IRR-based analysis.

## Features

- **Break-even analysis** — calculates when refinancing savings offset closing costs
- **Amortization comparison** — side-by-side schedules for current vs. refinanced loans
- **IRR computation** — internal rate of return for the refinance decision
- **Lender rate cards** — compare rates across multiple lenders
- **PMMS rate tracking** — pulls Freddie Mac Primary Mortgage Market Survey data
- **Rate alerts** — opt-in notifications when rates hit your target
- **Scenario modeling** — explore multiple what-if refinance scenarios

## Tech Stack

- **Framework:** Next.js 16 with React 19
- **Styling:** Tailwind CSS 4
- **Language:** TypeScript
- **Testing:** Vitest
- **Deployment:** Vercel

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Type check
npm run typecheck

# Build for production
npm run build
```

## Project Structure

```
app/            → Next.js app router pages and API routes
components/     → React UI components (inputs, displays, verdicts)
lib/            → Core calculation engine (amortization, breakeven, IRR)
data/           → Rate data and sample outputs
scripts/        → Rate fetching and alert utilities
__tests__/      → Vitest test suite
```

## License

Private
