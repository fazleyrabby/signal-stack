"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Rss, Layers, ShieldCheck, ArrowRight, Lock, KeyRound, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { SignalStats } from "@/lib/api";
import { triggerBackup } from "@/lib/api";
import { cn } from "@/lib/utils";

const ADMIN_KEY_STORAGE = "signalstack_admin_key";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const fetcher = (url: string) => fetch(url).then((r) => r.json());

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
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [accessKey, setAccessKey] = useState("");
  const [error, setError] = useState("");
  const { data: statsData } = useSWR<SignalStats>(`${API_BASE}/api/signals/stats`, fetcher);

  useEffect(() => {
    const savedKey = localStorage.getItem(ADMIN_KEY_STORAGE);
    if (savedKey === "dev-admin-key" || savedKey === "your-admin-key") {
      setIsAuthorized(true);
    }
  }, []);

  const handleLogin = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (accessKey === "dev-admin-key" || accessKey === "your-admin-key") {
      localStorage.setItem(ADMIN_KEY_STORAGE, accessKey);
      setIsAuthorized(true);
      setError("");
    } else {
      setError("INVALID_ACCESS_CREDENTIALS");
    }
  };

  const handleBackup = async () => {
    const adminKey = localStorage.getItem("admin_key") || "dev-admin-key";
    setIsBackingUp(true);
    try {
      await triggerBackup(adminKey);
      alert("✅ SNAPSHOT_STABLE: DATA_PIPELINE_BACKUP_COMPLETE");
    } catch (err) {
      alert("❌ SNAPSHOT_FAILED: PIPELINE_CORRUPTION_DETECTED");
    } finally {
      setIsBackingUp(false);
    }
  };

  const adminModules: AdminModule[] = [
    { title: "News Sources", description: "Manage intelligence telemetry feeds.", icon: Rss, href: "/admin/sources", variant: "default", stat: statsData?.topSource || "Connecting..." },
    { title: "Signal Categories", description: "Tune classification & routing logic.", icon: Layers, href: "/admin/categories", variant: "secondary", stat: "Active" },
    { title: "Database Backup", description: "Create a full corpus security snapshot.", icon: ShieldCheck, onClick: handleBackup, loading: isBackingUp, stat: "Ready" }
  ];

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 font-sans">
        <Card className="w-full max-w-md border-border bg-card/50 backdrop-blur-xl shadow-2xl rounded-lg overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-primary/20" />
          <CardHeader className="pt-10 pb-6 text-center">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4 border border-primary/20">
               <Lock className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-xl font-bold uppercase tracking-widest text-foreground">Admin Access</CardTitle>
            <CardDescription className="text-[10px] font-sans uppercase tracking-widest opacity-40 mt-1 text-center">
              Please enter your security key
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-10">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative group">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input 
                  type="password"
                  placeholder="SECURITY KEY..."
                  className="pl-10 h-12 bg-accent/20 border-border/40 rounded-lg font-sans text-sm tracking-widest w-full"
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  autoFocus
                />
              </div>
              {error && (
                <p className="text-[10px] font-bold text-destructive uppercase tracking-widest text-center animate-pulse">
                   ERROR: INVALID KEY
                </p>
              )}
              <Button 
                type="submit" 
                className="w-full h-12 rounded-lg font-bold uppercase tracking-widest shadow-lg shadow-primary/10 group overflow-hidden relative"
              >
                <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                Secure Login
              </Button>
            </form>
            <div className="mt-8 flex justify-center">
               <Link href="/" className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors group">
                  <ArrowRight className="w-3 h-3 rotate-180 group-hover:-translate-x-1 transition-transform" />
                  Back to Dashboard
               </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header isRefreshing={false} onRefresh={() => {}} searchQuery="" onSearchChange={() => {}} />

      <main className="max-w-6xl mx-auto py-12 px-6 space-y-12">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary text-[10px] font-bold uppercase tracking-[0.2em]">
            <ShieldCheck className="w-3 h-3" />
            <span>Admin Access Granted</span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter uppercase text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm">Manage news sources, categories, and database snapshots.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {adminModules.map((module) => (
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
                {module.onClick ? (
                  <Button onClick={module.onClick} disabled={module.loading} className="w-full h-10 text-[9px] font-black tracking-widest uppercase rounded-lg">
                    {module.loading ? "Processing..." : `Run ${module.title}`}
                  </Button>
                ) : (
                  <Link href={module.href || "/"} className="block">
                    <Button className="w-full h-10 text-[9px] font-black tracking-widest uppercase rounded-lg" variant={module.variant as any}>
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
