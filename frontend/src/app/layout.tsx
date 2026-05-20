import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, Hind_Siliguri, Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { SearchProvider } from "@/context/SearchContext";
import { LangHandler } from "@/components/LangHandler";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const hindSiliguri = Hind_Siliguri({
  variable: "--font-bengali",
  subsets: ["bengali", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const notoBengali = Noto_Sans_Bengali({
  variable: "--font-bengali-fallback",
  subsets: ["bengali"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SignalStack | Intelligent Terminal",
  description: "High-density strategic intelligence terminal for professional operational monitoring.",
  alternates: {
    types: {
      "application/rss+xml": "/api/feed.xml",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Blocking script: sets data-theme before paint to prevent flash */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('signalstack_theme');document.documentElement.setAttribute('data-theme',(t==='light'||t==='cyberpunk')?t:'onyx');})();` }} />
      </head>
      <body className={`${inter.variable} ${hindSiliguri.variable} ${notoBengali.variable} antialiased`} suppressHydrationWarning>
        <LangHandler />
        <ThemeProvider>
          <SearchProvider>
            <div className="pb-16 md:pb-0">{children}</div>
            <Suspense fallback={null}>
              <BottomNav />
            </Suspense>
            <Toaster richColors position="bottom-right" />
          </SearchProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
