"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Radio, RotateCcw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-foreground font-sans antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center">
          <div className="flex flex-col items-center gap-6 text-center px-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20">
              <Radio className="h-8 w-8 text-red-400 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black uppercase tracking-[0.2em] text-foreground">
                System Failure
              </h2>
              <p className="text-sm text-muted-foreground max-w-md">
                A critical error has occurred at the system level. The application was unable to recover from this fault.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={() => reset()}
                variant="default"
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                REBOOT SYSTEM
              </Button>
              <a
                href="/"
                className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-background px-2.5 h-8 gap-1.5 text-sm font-medium whitespace-nowrap transition-all hover:bg-muted hover:text-foreground"
              >
                <Home className="h-4 w-4" />
                RETURN TO BASE
              </a>
            </div>

            {process.env.NODE_ENV === "development" && error?.message && (
              <div className="mt-4 w-full max-w-lg rounded-xl border border-border/50 bg-card/30 p-4 backdrop-blur-sm">
                <p className="text-[10px] font-mono text-muted-foreground break-all">
                  {error.message}
                </p>
              </div>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
