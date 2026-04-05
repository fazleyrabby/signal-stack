"use client";

import { cn } from "@/lib/utils";
import { 
  Globe2, 
  Cpu, 
  ShieldAlert, 
  Zap, 
  BrainCircuit, 
  Settings, 
  LayoutDashboard,
  Filter,
  Activity,
  Paintbrush
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { name: 'Terminal', href: '/', icon: LayoutDashboard },
  { name: 'Intelligence', href: '/intelligence', icon: BrainCircuit },
  { name: 'Systems', href: '/admin', icon: Settings },
];

const categories = [
  { name: 'Geopolitics', id: 'geopolitics', icon: Globe2, color: 'text-violet-400' },
  { name: 'Technology', id: 'technology', icon: Cpu, color: 'text-blue-400' },
];

const severities = [
  { name: 'Critical', id: 'high', color: 'bg-red-500' },
  { name: 'Strategic', id: 'medium', color: 'bg-amber-500' },
  { name: 'General', id: 'low', color: 'bg-blue-500' },
];

import { useEffect, useState } from "react";

const themes = [
  { id: 'onyx', name: 'Onyx', color: 'bg-zinc-900 border-zinc-700' },
  { id: 'cyberpunk', name: 'Cyber', color: 'bg-fuchsia-900 border-fuchsia-500' },
  { id: 'nord', name: 'Nord', color: 'bg-slate-700 border-slate-500' },
  { id: 'winter', name: 'Frost', color: 'bg-white border-blue-200 text-black' },
  { id: 'light', name: 'Lite', color: 'bg-zinc-100 border-zinc-200 text-black' },
];

export function Sidebar({ 
  selectedCategory, 
  onCategoryChange,
  selectedSeverity,
  onSeverityChange 
}: { 
  selectedCategory?: string;
  onCategoryChange?: (id: string) => void;
  selectedSeverity?: string;
  onSeverityChange?: (id: string) => void;
}) {
  const pathname = usePathname();
  const [currentTheme, setCurrentTheme] = useState('onyx');

  useEffect(() => {
    const savedTheme = localStorage.getItem('ss_theme') || 'onyx';
    setCurrentTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const changeTheme = (themeId: string) => {
    setCurrentTheme(themeId);
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem('ss_theme', themeId);
  };

  return (
    <div className="flex flex-col h-full bg-card border-r border-border/40 w-64 shrink-0 transition-all duration-300">
      {/* Brand */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <span className="font-black tracking-tighter text-lg uppercase italic">SignalStack</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-8">
        {/* Main Nav */}
        <nav className="space-y-1">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group",
                pathname === item.href 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <item.icon className={cn("w-4 h-4", pathname === item.href ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
              {item.name}
            </Link>
          ))}
        </nav>

        {/* Intelligence Streams */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
            Intelligence Streams
          </div>
          <div className="space-y-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => onCategoryChange?.(cat.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group",
                  selectedCategory === cat.id 
                    ? "bg-accent text-foreground" 
                    : "text-muted-foreground hover:bg-accent/30 hover:text-foreground"
                )}
              >
                <cat.icon className={cn("w-4 h-4", selectedCategory === cat.id ? cat.color : "text-muted-foreground group-hover:text-foreground")} />
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-3">
            <Filter className="w-3 h-3 text-muted-foreground/50" />
            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Priority Filters</h4>
          </div>
          <div className="space-y-1">
            <button
               onClick={() => onSeverityChange?.('all')}
               className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                selectedSeverity === 'all' ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="w-1.5 h-1.5 rounded-full border border-border" />
              All Signals
            </button>
            {severities.map((sev) => (
              <button
                key={sev.id}
                onClick={() => onSeverityChange?.(sev.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group",
                  selectedSeverity === sev.id 
                    ? "bg-accent text-foreground" 
                    : "text-muted-foreground hover:bg-accent/30 hover:text-foreground"
                )}
              >
                <div className={cn("w-1.5 h-1.5 rounded-full", sev.color)} />
                {sev.name}
              </button>
            ))}
          </div>
        </div>

        {/* Theme Engine */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-3">
            <Paintbrush className="w-3 h-3 text-muted-foreground/50" />
            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Theming Engine</h4>
          </div>
          <div className="grid grid-cols-5 gap-2 px-3">
             {themes.map(t => (
               <button
                  key={t.id}
                  onClick={() => changeTheme(t.id)}
                  title={t.name}
                  className={cn(
                    "h-8 rounded-lg border-2 transition-all hover:scale-110",
                    t.color,
                    currentTheme === t.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "opacity-60"
                  )}
               />
             ))}
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="p-4 mt-auto">
        <div className="p-3 rounded-xl bg-accent/20 border border-border/40">
           <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-tighter text-foreground/80">Systems Nominal</span>
           </div>
           <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary w-[85%] animate-shimmer" />
           </div>
        </div>
      </div>
    </div>
  );
}
