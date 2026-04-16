"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loginAdmin } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, ShieldAlert, Loader2 } from "lucide-react";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const cookies = document.cookie;
    if (cookies.includes('signalstack_access_token')) {
      router.replace("/admin");
    }
  }, [router]);

  if (!mounted) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const success = await loginAdmin(email, password);

      if (success) {
        window.location.href = "/admin";
      } else {
        setError("Invalid email or password.");
      }
    } catch {
      setError("Unable to connect to the Admin Hub.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
            <KeyRound className="w-6 h-6 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold uppercase tracking-wide">Security Protocol</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.3em] mt-1">Authorized Access Only</p>
          </div>
        </div>

        {/* Login Form */}
        <div className="rounded-lg border border-border/10 p-5">
          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400 text-xs">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Terminal ID</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@signalstack.local"
                required
                className="bg-background border-border/20 h-10 text-sm"
              />
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Access Key</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="bg-background border-border/20 h-10 text-sm"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-10 font-bold uppercase tracking-wider text-xs" 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Initialize Uplink"
              )}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-center gap-3 text-muted-foreground/30">
          <div className="h-px w-6 bg-current" />
          <p className="text-[9px] uppercase tracking-[0.4em] font-bold">SignalStack Alpha</p>
          <div className="h-px w-6 bg-current" />
        </div>
      </div>
    </div>
  );
}