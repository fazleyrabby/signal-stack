import * as React from "react";

interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
}

export function ResizeHandle({ onMouseDown }: ResizeHandleProps) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute right-0 top-0 h-full w-2 cursor-col-resize flex items-center justify-center group/handle select-none z-10"
    >
      <div className="w-px h-4 bg-border/50 group-hover/handle:bg-primary/60 group-hover/handle:w-0.5 transition-all" />
    </div>
  );
}
