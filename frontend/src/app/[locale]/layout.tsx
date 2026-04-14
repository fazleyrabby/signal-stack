export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Locale is resolved server-side by next-intl's withNextIntl plugin via i18n.ts.
  // Await params to satisfy Next.js dynamic segment typing; no HTML wrapping needed
  // since app/layout.tsx already provides the full document structure and providers.
  await params;
  return <>{children}</>;
}
