"use client";

import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Settings, Rss, Layers, ShieldCheck, ArrowRight } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import type { SignalStats } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const fetcher = (url: string) => fetch(url).then((r) => r.json());

import { useState } from "react";
import { triggerBackup } from "@/lib/api";

interface AdminModule {
  title: string;
  description: string;
  icon: any;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "secondary" | "ghost";
  disabled?: boolean;
  stat: string;
  loading?: boolean;
}

export default function AdminDashboard() {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const { data: statsData } = useSWR<SignalStats>(`${API_BASE}/api/signals/stats`, fetcher);

  const handleBackup = async () => {
    const adminKey = localStorage.getItem("admin_key") || "dev-admin-key";
    setIsBackingUp(true);
    try {
      await triggerBackup(adminKey);
      alert("✅ Backup successful! SignalStack data captured safely.");
    } catch (err) {
      alert("❌ Backup failed. Check system logs.");
    } finally {
      setIsBackingUp(false);
    }
  };

  const adminModules: AdminModule[] = [
    {
      title: "Feed Sources",
      description: "Manage RSS feeds and their trust scores.",
      icon: Rss,
      href: "/admin/sources",
      variant: "default",
      stat: statsData?.topSource || "..."
    },
    {
      title: "Category Settings",
      description: "Create and edit geopolitical or tech categories.",
      icon: Layers,
      href: "/admin/categories",
      variant: "secondary",
      stat: "Live"
    },
    {
      title: "System Backup",
      description: "Snapshot the entire database to a SQL file.",
      icon: ShieldCheck,
      onClick: handleBackup,
      loading: isBackingUp,
      stat: "Idle"
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-950/20">
      <Header isLive={true} onRefresh={() => {}} isRefreshing={false} />

      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-widest">
              <Settings className="w-3 h-3" />
              <span>System Console</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">SignalStack Administration</h1>
            <p className="text-muted-foreground">Manage data flows, ingestion sources, and category classification.</p>
          </div>

          <Separator className="opacity-20" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {adminModules.map((module) => (
              <Card key={module.title} className={(module as any).disabled ? "opacity-60 cursor-not-allowed group/item" : "transition-all hover:border-primary/50 group/item"}>
                <CardHeader>
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <module.icon className="w-5 h-5 text-primary" />
                  </div>
                  <CardTitle className="flex items-center justify-between">
                    {module.title}
                    {!(module as any).disabled && (
                      <ArrowRight className="w-4 h-4 opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-1 transition-all" />
                    )}
                  </CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-xs font-mono py-2 px-3 rounded bg-muted/50 flex items-center justify-between">
                    <span className="opacity-50 uppercase">Status</span>
                    <span className="font-bold">{(module as any).loading ? "Working..." : module.stat}</span>
                  </div>
                  {(module as any).onClick ? (
                    <Button onClick={(module as any).onClick} className="w-full" disabled={(module as any).loading}>
                      {(module as any).loading ? "Backing up..." : `Trigger ${module.title}`}
                    </Button>
                  ) : !(module as any).disabled ? (
                    <Button render={<Link href={(module as any).href} />} nativeButton={false} className="w-full" variant={module.variant as any}>
                      Open {module.title}
                    </Button>
                  ) : (
                    <Button className="w-full" variant="ghost" disabled>
                      Coming Soon
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
