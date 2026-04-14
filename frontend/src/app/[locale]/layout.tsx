import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { BottomNav } from "@/components/bottom-nav";
import { SearchProvider } from "@/context/SearchContext";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
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

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`} suppressHydrationWarning>
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
