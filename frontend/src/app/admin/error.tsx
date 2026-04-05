"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Radio, RotateCcw, Home } from "lucide-react";

export default function Error({
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-6 text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20">
          <Radio className="h-8 w-8 text-red-400 animate-pulse" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-black uppercase tracking-[0.2em] text-foreground">
            Admin Signal Interrupted
          </h2>
          <p className="text-sm text-muted-foreground max-w-md">
            A node transmission error occurred in the admin panel.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => reset()}
            variant="default"
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            RETRY CONNECTION
          </Button>
          <a
            href="/admin"
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-background px-2.5 h-8 gap-1.5 text-sm font-medium whitespace-nowrap transition-all hover:bg-muted hover:text-foreground"
          >
            <Home className="h-4 w-4" />
            Admin Home
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
  );
}
