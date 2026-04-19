"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";

interface ApiHealthWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ApiHealthWrapper({ children }: ApiHealthWrapperProps) {
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");

  const checkApi = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const res = await fetch("/api/health", { 
        method: "GET",
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);
      
      if (res.ok) {
        setStatus("online");
      } else {
        setStatus("offline");
      }
    } catch {
      setStatus("offline");
    }
  }, []);

  useEffect(() => {
    checkApi();
    
    const interval = setInterval(checkApi, 15000);
    return () => clearInterval(interval);
  }, [checkApi]);

  if (status === "offline") {
    return <MaintenancePage onReload={() => {
      setStatus("checking");
      checkApi();
    }} />;
  }

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Connecting...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

interface MaintenancePageProps {
  onReload: () => void;
}

function MaintenancePage({ onReload }: MaintenancePageProps) {
  const emojis = ["😴", "🔋", "⚡", "🛠️", "🧹"];
  const [emoji, setEmoji] = useState(emojis[0]);
  const [progress, setProgress] = useState(0);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    
    const interval = setInterval(() => {
      setEmoji(emojis[Math.floor(Math.random() * emojis.length)]);
    }, 2500);
    
    return () => clearInterval(interval);
  }, [isClient]);

  useEffect(() => {
    if (!isClient) return;
    
    const interval = setInterval(() => {
      setProgress(p => {
        const next = p + (Math.random() * 25);
        return next > 100 ? 0 : next;
      });
    }, 800);
    
    return () => clearInterval(interval);
  }, [isClient]);

  const handleReload = () => {
    onReload();
  };

  if (!isClient) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-950 via-indigo-950 to-zinc-950">
      <div className="text-center px-4 max-w-md">
        <div className="text-8xl mb-4 animate-bounce">{emoji}</div>
        <h1 className="text-4xl font-bold text-white mb-2">SignalStack</h1>
        <p className="text-indigo-300 text-lg mb-8">
          We&apos;re giving our servers a quick coffee break. Be right back! ☕
        </p>
        
        <div className="w-64 h-2 bg-white/10 rounded-full mx-auto mb-4 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <p className="text-indigo-400 text-sm uppercase tracking-widest mb-6">
          Recharging circuits...
        </p>

        <button 
          onClick={handleReload}
          className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
        >
          Try Again
        </button>
        
        <div className="mt-8 flex gap-4 justify-center">
          <a 
            href="https://github.com/fazleyrabby/signal-stack" 
            target="_blank"
            className="text-indigo-400 hover:text-white transition-colors text-sm"
          >
            GitHub
          </a>
          <span className="text-white/20">•</span>
          <a 
            href="mailto:admin@signalstack.local" 
            className="text-indigo-400 hover:text-white transition-colors text-sm"
          >
            Contact
          </a>
        </div>
      </div>
    </div>
  );
}

export default ApiHealthWrapper;