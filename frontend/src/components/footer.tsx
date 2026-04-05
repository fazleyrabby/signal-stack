import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border/10 bg-background/50 backdrop-blur-sm py-2">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[9px] font-mono uppercase tracking-widest text-muted-foreground/40">
        <span>© 2026 SignalStack</span>
        <div className="flex items-center gap-3">
          <Link href="/changelog" className="hover:text-foreground transition-colors">
            Changelog
          </Link>
          <Link href="https://fazleyrabbi.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
            Portfolio
          </Link>
        </div>
      </div>
    </footer>
  );
}
