"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Rss, 
  Settings, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  Shield,
  Activity,
  Menu,
  X,
  Globe,
  Database
} from "lucide-react";
import { logoutAdmin } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const navItems = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Signals', href: '/admin/signals', icon: Activity },
  { name: 'Sources', href: '/admin/sources', icon: Rss },
  { name: 'Logs', href: '/admin/logs', icon: Database },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem("admin_sidebar_collapsed");
    if (saved !== null) setIsCollapsed(saved === "true");
  }, []);

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem("admin_sidebar_collapsed", String(next));
  };

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-[60]">
        <Button 
          variant="outline" 
          size="icon" 
          className="bg-background/80 backdrop-blur-md border-border/40 shadow-lg"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
        >
          {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[50]" 
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-[55] flex flex-col bg-card border-r border-border/40 transition-all duration-300 ease-in-out lg:static",
        isCollapsed ? "w-[80px]" : "w-64",
        isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Brand */}
        <div className={cn(
          "h-16 flex items-center gap-3 px-6 border-b border-border/10",
          isCollapsed && "px-0 justify-center"
        )}>
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary shadow-lg shadow-primary/20 shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col leading-none">
              <span className="text-[11px] font-black tracking-[0.2em] uppercase text-foreground">Admin</span>
              <span className="text-[11px] font-black tracking-[0.2em] uppercase text-primary">Terminal</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all group",
                  active 
                    ? "bg-primary/10 text-primary shadow-sm" 
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5 transition-transform group-hover:scale-110 shrink-0",
                  active ? "text-primary" : "text-muted-foreground/60 group-hover:text-foreground"
                )} />
                {!isCollapsed && <span>{item.name}</span>}
                {active && !isCollapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Action Controls */}
        <div className="p-4 border-t border-border/10 space-y-2">
          {!isCollapsed && (
            <Link href="/" className="block">
              <Button variant="ghost" className="w-full justify-start gap-3 h-10 px-3 text-muted-foreground hover:text-foreground rounded-lg">
                <Globe className="w-5 h-5" />
                <span>Public Feed</span>
              </Button>
            </Link>
          )}
          
          <Button 
            variant="ghost" 
            className={cn(
              "w-full gap-3 h-10 px-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg",
              isCollapsed ? "justify-center" : "justify-start"
            )}
            onClick={() => {
              if (confirm("Terminate admin session?")) {
                logoutAdmin();
                window.location.href = '/admin-login';
              }
            }}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!isCollapsed && <span className="font-bold">Logout</span>}
          </Button>

          {/* Collapse Toggle (Desktop only) */}
          <button 
            onClick={toggleCollapse}
            className="hidden lg:flex w-full items-center justify-center h-10 rounded-lg hover:bg-accent/50 text-muted-foreground/40 hover:text-foreground transition-all mt-4 border border-border/5"
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
      </aside>
    </>
  );
}
