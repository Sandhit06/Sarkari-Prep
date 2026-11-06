import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const themeScript = `(function(){try{var s=localStorage.getItem("sp-theme");var d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;

export const metadata: Metadata = {
  title: "SarkariPrep — Government exam preparation, without the paywall",
  description:
    "Practice official previous year papers in an exam-accurate CBT simulator, convert any paper into a mock test, and track topic-level mastery. Free and open source, forever.",
  applicationName: "SarkariPrep",
  keywords: ["SSC CGL", "UPSC", "IBPS PO", "RRB NTPC", "government exam", "mock test", "PYQ", "CBT"],
  authors: [{ name: "SarkariPrep contributors" }],
  openGraph: {
    title: "SarkariPrep — Exam prep without the paywall",
    description: "Bilingual PYQs, a real CBT simulator and an open paper converter. AGPL-3.0, free forever.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#070a12" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh font-sans antialiased">
        <a
          href="#main"
          className="sr-only z-[60] rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
