import { Suspense } from "react";
import { SWRConfig } from 'swr';
import SignalsDashboardContent from "@/components/SignalsDashboardContent";

const API_BACKEND = process.env.API_BACKEND_URL || 'http://localhost:3000';

async function getInitialSignals(locale: string) {
  try {
    const res = await fetch(
      `${API_BACKEND}/api/signals?limit=30&categoryId=geopolitics&sort=created_at&order=desc&lang=${locale}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error('Failed to fetch initial signals:', e);
    return null;
  }
}

export default async function SignalsDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const initialData = await getInitialSignals(locale);

  // Prefetching keys for SWR fallback
  const fallback: Record<string, any> = {};
  if (initialData) {
    const key = `/api/signals?limit=30&categoryId=geopolitics&sort=created_at&order=desc&lang=${locale}`;
    fallback[key] = initialData;
  }

  return (
    <SWRConfig value={{ fallback }}>
      <Suspense fallback={<div className="h-screen bg-background animate-pulse" />}>
        <SignalsDashboardContent />
      </Suspense>
    </SWRConfig>
  );
}