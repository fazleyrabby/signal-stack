"use client";

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface SortableHeadProps {
  label: string;
  column: string;
  sort: string;
  order: "asc" | "desc";
  onSort: (column: string) => void;
  width?: number;
  className?: string;
  children?: React.ReactNode; // for ResizeHandle
}

export function SortableHead({ label, column, sort, order, onSort, width, className, children }: SortableHeadProps) {
  const active = sort === column;
  return (
    <TableHead
      className={cn(
        "relative h-8 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground overflow-visible select-none cursor-pointer hover:text-foreground transition-colors",
        active && "text-primary",
        className,
      )}
      style={width ? { width } : undefined}
      onClick={() => onSort(column)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active ? (
          order === "asc"
            ? <ChevronUp className="w-3 h-3 shrink-0" />
            : <ChevronDown className="w-3 h-3 shrink-0" />
        ) : (
          <ChevronsUpDown className="w-3 h-3 shrink-0 opacity-30" />
        )}
      </span>
      {children}
    </TableHead>
  );
}

/** Toggle helper — same column flips order, new column defaults to asc */
export function toggleSort(
  current: { sort: string; order: "asc" | "desc" },
  column: string,
): { sort: string; order: "asc" | "desc" } {
  if (current.sort === column) {
    return { sort: column, order: current.order === "asc" ? "desc" : "asc" };
  }
  return { sort: column, order: "asc" };
}
