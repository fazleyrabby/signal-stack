"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function SignalCardSkeleton() {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="p-4 sm:p-5">
        <Skeleton className="h-5 w-4/5 mb-3" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-16 ml-auto" />
        </div>
      </CardContent>
    </Card>
  );
}

export function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <SignalCardSkeleton key={i} />
      ))}
    </div>
  );
}
