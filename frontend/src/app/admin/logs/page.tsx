"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Database, Loader2, RefreshCw, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function AdminLogs() {
  const [logs, setLogs] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetchLogs = async (isRefreshing = false) => {
    if (isRefreshing) setRefreshing(true);
    else setLoading(true);
    
    try {
      const res = await fetch(`${API_BASE}/api/admin/logs`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/admin-login");
        }
        throw new Error("Failed to load logs");
      }
      const data = await res.json();
      setLogs(data.logs || "No logs available.");
    } catch (err) {
      console.error(err);
      setLogs("FAILED_TO_LOAD_PROTOCOL_LOGS: System response 500");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [router]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Initializing Terminal Access...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8 space-y-8">
      <div className="max-w-[1400px] mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight">System Diagnostics</h1>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.3em] flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-primary" />
              Real-time Kernel Events & Trace Logs
            </p>
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchLogs(true)} 
            disabled={refreshing}
            className="rounded-lg gap-2 h-10 px-6 border-border/10 bg-card/50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="text-[10px] font-black uppercase tracking-widest">Refresh Logs</span>
          </Button>
        </div>

        {/* Logs Terminal */}
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-violet-500/20 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-1000"></div>
          <div className="relative bg-zinc-950 rounded-2xl border border-white/5 shadow-2xl overflow-hidden flex flex-col">
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-6 py-3 bg-white/5 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/50" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/50" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/50" />
                </div>
                <div className="w-px h-4 bg-white/10 mx-2" />
                <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-[10px] font-mono text-zinc-500 font-bold uppercase tracking-widest">signalstack_runtime.log</span>
              </div>
              <div className="text-[10px] font-mono text-zinc-600">UTF-8</div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-auto custom-scrollbar max-h-[70vh]">
              <pre className="font-mono text-[11px] leading-relaxed text-zinc-400 selection:bg-primary/30 selection:text-white whitespace-pre-wrap">
                {logs}
              </pre>
            </div>
            
            {/* Terminal Footer */}
            <div className="px-6 py-2 bg-white/[0.02] border-t border-white/5 flex justify-between items-center">
              <span className="text-[9px] font-mono text-zinc-600 uppercase">Live Stream Active</span>
              <span className="text-[9px] font-mono text-zinc-600 uppercase">Line: {logs.split('\n').length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
