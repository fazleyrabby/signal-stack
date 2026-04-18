"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "@/components/AdminSidebar";
import { verifyAdminSession } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import { CrawlProvider, useCrawl } from "@/context/CrawlContext";

function CrawlStatusPill() {
  const { crawling, source } = useCrawl();
  if (!crawling) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border shadow-lg text-xs font-medium text-muted-foreground">
      <Loader2 className="w-3 h-3 animate-spin text-primary shrink-0" />
      Crawling {source}… you can navigate away
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authorized = await verifyAdminSession();
        if (!authorized) {
          router.replace("/admin-login");
        } else {
          setIsAuthorized(true);
        }
      } catch {
        router.replace("/admin-login");
      }
    };
    checkAuth();
  }, [router]);

  if (isAuthorized !== true) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Verifying access...</span>
        </div>
      </div>
    );
  }

  return (
    <CrawlProvider>
      <div className="flex h-screen bg-background overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          <div className="flex-1 flex flex-col overflow-hidden">
            {children}
          </div>
        </main>
        <CrawlStatusPill />
      </div>
    </CrawlProvider>
  );
}