import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales } from "@/navigation";
import type { Metadata } from "next";
import { siteUrl } from "@/lib/server-stories";

export const metadata: Metadata = { metadataBase: new URL(siteUrl) };

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!(locales as readonly string[]).includes(locale)) notFound();
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <div className="public-surface">{children}</div>
    </NextIntlClientProvider>
  );
}
