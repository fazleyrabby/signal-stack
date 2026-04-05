"use client";

import { useState } from "react";
import useSWR from "swr";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Rss, Layers, ShieldCheck, ArrowRight, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SignalStats } from "@/lib/api";
import { cn } from "@/lib/utils";
import { logoutAdmin } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const fetcher = (url: string) => fetch(url, { credentials: "include" }).then((r) => r.json());

export default function AdminDashboard() {
  const router = useRouter();
  const [isBackingUp, setIsBackingUp] = useState(false);
  const { data: statsData } = useSWR<SignalStats>(`${API_BASE}/api/signals/stats`, fetcher);

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/backup`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        alert("✅ SNAPSHOT_STABLE: DATA_PIPELINE_BACKUP_COMPLETE");
      } else {
        alert("❌ SNAPSHOT_FAILED: PIPELINE_CORRUPTION_DETECTED");
      }
    } catch {
      alert("❌ SNAPSHOT_FAILED: PIPELINE_CORRUPTION_DETECTED");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleLogout = async () => {
    await logoutAdmin();
    router.push("/admin/login");
    router.refresh();
  };

  const modules = [
    { title: "News Sources", description: "Manage intelligence telemetry feeds.", icon: Rss, href: "/admin/sources", variant: "default" as const, stat: statsData?.topSource || "Connecting..." },
    { title: "Signal Categories", description: "Tune classification & routing logic.", icon: Layers, href: "/admin/categories", variant: "secondary" as const, stat: "Active" },
    { title: "Database Backup", description: "Create a full corpus security snapshot.", icon: ShieldCheck, onClick: handleBackup, loading: isBackingUp, stat: "Ready" }
  ];

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header isRefreshing={false} onRefresh={() => {}} searchQuery="" onSearchChange={() => {}} />

      <main className="max-w-6xl mx-auto py-12 px-6 space-y-12">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary text-[10px] font-bold uppercase tracking-[0.2em]">
              <ShieldCheck className="w-3 h-3" />
              <span>Admin Access Granted</span>
            </div>
            <h1 className="text-4xl font-black tracking-tighter uppercase text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground text-sm">Manage news sources, categories, and database snapshots.</p>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="gap-2 text-[10px] font-black uppercase tracking-widest"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {modules.map((module) => (
            <Card key={module.title} className="bg-card border-border shadow-sm hover:border-primary/40 transition-all duration-500 overflow-hidden group rounded-lg">
              <CardHeader className="pb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <module.icon className="w-5 h-5 text-primary" />
                </div>
                <CardTitle className="text-lg font-bold tracking-tight uppercase text-foreground">{module.title}</CardTitle>
                <CardDescription className="text-xs text-muted-foreground font-medium">{module.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-[10px] font-sans py-2.5 px-3 rounded-md bg-secondary/50 border border-border/40 flex items-center justify-between">
                  <span className="text-muted-foreground uppercase font-black">Status</span>
                  <span className="font-bold text-foreground">{module.stat.toUpperCase()}</span>
                </div>
                {"onClick" in module ? (
                  <Button onClick={module.onClick} disabled={module.loading} className="w-full h-10 text-[9px] font-black tracking-widest uppercase rounded-lg">
                    {module.loading ? "Processing..." : `Run ${module.title}`}
                  </Button>
                ) : (
                  <Link href={module.href || "/"} className="block">
                    <Button className="w-full h-10 text-[9px] font-black tracking-widest uppercase rounded-lg" variant={module.variant}>
                      Access {module.title}
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
