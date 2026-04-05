"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SignalCardSkeleton({ isCompact = false }: { isCompact?: boolean }) {
  return (
    <Card className={cn(
      "relative overflow-hidden bg-card border-border/40",
      isCompact ? "rounded-none border-b" : "rounded-xl border"
    )}>
      <CardContent className={cn("p-4", isCompact && "p-3")}>
        <div className="flex gap-4">
          {/* Pillar Skeleton */}
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="w-2 h-2 rounded-full shrink-0" />
            {!isCompact && <div className="w-px flex-1 bg-border/20 min-h-[40px]" />}
          </div>

          <div className="flex-1 space-y-3">
             {/* Title Skeleton */}
             <Skeleton className={cn("w-3/4", isCompact ? "h-4" : "h-5")} />
             
             {/* Metadata Skeleton */}
             <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-12" />
             </div>

             {/* Description Skeleton (Expanded only) */}
             {!isCompact && <Skeleton className="h-10 w-full rounded-lg" />}

             {/* Footer Badges */}
             <div className="flex items-center gap-3 pt-2">
                <Skeleton className="h-5 w-24 rounded-md" />
                <Skeleton className="h-5 w-16 rounded-md ml-auto" />
             </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function FeedSkeleton({ layoutMode = 'list' }: { layoutMode?: 'grid' | 'list' }) {
  return (
    <div className={layoutMode === 'grid' ? "grid grid-cols-1 xl:grid-cols-2 gap-4" : "space-y-px"}>
      {Array.from({ length: 8 }).map((_, i) => (
        <SignalCardSkeleton key={i} isCompact={layoutMode === 'list'} />
      ))}
    </div>
  );
}
