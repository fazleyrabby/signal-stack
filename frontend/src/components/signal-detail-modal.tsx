"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { Signal } from "@/lib/api";

interface SignalDetailModalProps {
  signal: Signal | null;
  onOpenChange: (signal: Signal | null) => void;
}

export function SignalDetailModal({ signal, onOpenChange }: SignalDetailModalProps) {
  const handleOpenChange = (open: boolean) => {
    if (!open) onOpenChange(null);
  };

  if (!signal) {
    return null;
  }

  const severityBadgeClass = {
    high: "bg-red-500 text-white",
    medium: "bg-amber-500 text-white",
    low: "bg-green-500 text-white",
  }[signal.severity];

  const publishedDate = signal.publishedAt 
    ? format(new Date(signal.publishedAt), "MMM d, yyyy HH:mm") 
    : "Unknown";

  return (
    <Dialog 
      open={!!signal} 
      onOpenChange={handleOpenChange}
    >
      <DialogContent className="sm:max-w-lg p-6">
        <DialogHeader className="space-y-4">
          <DialogTitle className="text-lg font-semibold">
            <a 
              href={signal.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:text-primary transition-colors"
            >
              {signal.title}
            </a>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground space-y-3">
            {/* AI Summary */}
            {signal.aiSummary && (
              <>
                <p className="font-medium mb-1">AI Summary</p>
                <p className="text-sm">{signal.aiSummary}</p>
              </>
            )}
            
            {/* Content Snippet */}
            {signal.content && (
              <>
                <p className="font-medium mb-1">Content Preview</p>
                <p className="text-sm line-clamp-4">{signal.content.substring(0, 300)}{signal.content.length > 300 ? "..." : ""}</p>
              </>
            )}
            
            {/* Metadata */}
            <div className="border-t pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Source:</span> <span className="text-muted-foreground">{signal.source}</span>
                </div>
                <div>
                  <span className="font-medium">Score:</span> <span className="text-muted-foreground">{signal.score}</span>
                </div>
                <div>
                  <span className="font-medium">Severity:</span> 
                  <Badge variant="secondary" className={severityBadgeClass}>
                    {signal.severity.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <span className="font-medium">Published:</span> <span className="text-muted-foreground">{publishedDate}</span>
                </div>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(null)}
          >
            Close
          </Button>
          <a
            href={signal.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button className="ml-2">
              Read Original
            </Button>
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}