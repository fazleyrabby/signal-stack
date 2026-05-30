"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface GoogleAdProps {
  client?: string;
  slot: string;
  format?: string;
  responsive?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function GoogleAd({
  client = "ca-pub-5912010310110935",
  slot,
  format = "auto",
  responsive = true,
  className,
  style,
}: GoogleAdProps) {
  const [adFailed, setAdFailed] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (initialized.current) return;
    initialized.current = true;

    try {
      const adsbygoogle = (window as any).adsbygoogle || [];
      adsbygoogle.push({});
    } catch (err) {
      console.warn("AdSense failed to push:", err);
      setAdFailed(true);
    }
  }, []);

  return (
    <Card className={cn(
      "group relative overflow-hidden transition-all duration-300 rounded-sm border-0",
      "bg-muted/15 hover:bg-muted/30 p-3 sm:p-4 min-h-[220px] flex flex-col justify-between gap-3 border-l-4 border-l-primary/30",
      className
    )}>
      {/* Header matching SignalCard */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary shrink-0">
            SPONSOR
          </span>
          <span className="text-[10px] text-muted-foreground/40 font-mono tracking-widest shrink-0">
            PARTNER INTEL
          </span>
        </div>
      </div>

      {/* Ad Area Container */}
      <div className="flex-1 flex items-center justify-center min-h-[140px] w-full overflow-hidden rounded-sm bg-black/10 border border-border/5">
        {!adFailed ? (
          <div className="w-full h-full flex items-center justify-center">
            <ins
              className="adsbygoogle w-full h-full block"
              style={style || { display: "block" }}
              data-ad-client={client}
              data-ad-slot={slot}
              data-ad-format={format}
              data-full-width-responsive={responsive ? "true" : "false"}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-4 text-center">
            <span className="text-[11px] font-bold text-muted-foreground/60 leading-snug">
              Support SignalStack
            </span>
            <span className="text-[8px] font-black font-mono text-muted-foreground/30 mt-1.5 uppercase tracking-[0.2em]">
              Ad Blocked / Offline
            </span>
          </div>
        )}
      </div>

      {/* Footer matching SignalCard */}
      <div className="flex items-center justify-between pt-2 border-t border-border/5">
        <span className="text-[8px] text-muted-foreground/30 font-black uppercase tracking-[0.2em]">
          ADVERTISEMENT
        </span>
        <span className="text-[9px] text-muted-foreground/50 hover:text-foreground cursor-pointer transition-colors font-bold uppercase tracking-wider">
          info
        </span>
      </div>
    </Card>
  );
}
