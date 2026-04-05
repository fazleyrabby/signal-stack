"use client";

import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function Shell({ 
  children,
  selectedCategory,
  onCategoryChange,
  selectedSeverity,
  onSeverityChange
}: { 
  children: React.ReactNode;
  selectedCategory?: string;
  onCategoryChange?: (id: string) => void;
  selectedSeverity?: string;
  onSeverityChange?: (id: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar 
        selectedCategory={selectedCategory}
        onCategoryChange={onCategoryChange}
        selectedSeverity={selectedSeverity}
        onSeverityChange={onSeverityChange}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header 
          isRefreshing={false}
          onRefresh={() => window.location.reload()}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <main className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="p-6 h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
