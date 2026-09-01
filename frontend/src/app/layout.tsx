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

import { cookies } from "next/headers";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("signalstack_theme")?.value || "onyx";

  return (
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <head>
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
            <a
              href="https://fazleyrabbi.xyz/"
              target="_blank"
              rel="noopener noreferrer"
              className="fixed bottom-4 right-4 z-50 hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 backdrop-blur-md shadow-lg hover:bg-black/10 dark:hover:bg-white/10 hover:scale-105 hover:-translate-y-0.5 active:scale-95 transition-all duration-300 group"
              style={{ fontSize: '10px' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse shrink-0" />
              <span className="font-bold tracking-wide text-black/40 dark:text-white/40 group-hover:text-black/70 dark:group-hover:text-white/70 transition-colors uppercase" style={{ letterSpacing: '0.08em' }}>
                made by <span className="text-violet-600 dark:text-violet-400 group-hover:text-violet-500 dark:group-hover:text-violet-300">fazleyrabbi</span>
              </span>
            </a>
          </SearchProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
