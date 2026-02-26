import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://refinanceclarityengine.com";
const SITE_NAME = "Refinance Clarity Engine";
const DESCRIPTION =
  "Should you refinance your mortgage? Get a clear, honest answer in 60 seconds. " +
  "Break-even calculator, scenario comparison, and plain-English verdict. No ads. No lender steering.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default: `${SITE_NAME} — Should You Refinance?`,
    template: `%s — ${SITE_NAME}`,
  },

  description: DESCRIPTION,

  keywords: [
    "should I refinance",
    "refinance calculator",
    "mortgage refinance calculator",
    "refinance break even calculator",
    "is it worth refinancing",
    "mortgage break even point",
    "refinance savings calculator",
    "when to refinance mortgage",
  ],

  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,

  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Should You Refinance?`,
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
  },

  twitter: {
    card: "summary",
    title: `${SITE_NAME} — Should You Refinance?`,
    description:
      "Clear, honest refinance math in 60 seconds. Break-even analysis, scenario comparison. No ads or lender steering.",
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
    },
  },

  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
