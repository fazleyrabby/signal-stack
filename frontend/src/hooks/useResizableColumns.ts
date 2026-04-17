import { useState, useCallback } from "react";

export function useResizableColumns(initialWidths: number[]) {
  const [widths, setWidths] = useState<number[]>(initialWidths);

  const startResize = useCallback((colIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = widths[colIndex];

    function onMove(ev: MouseEvent) {
      const delta = ev.clientX - startX;
      setWidths((prev) => {
        const next = [...prev];
        next[colIndex] = Math.max(40, startWidth + delta);
        return next;
      });
    }

    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [widths]);

  return { widths, startResize };
}
