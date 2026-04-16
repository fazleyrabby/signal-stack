export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-foreground">
      <div className="flex flex-col items-center gap-6 text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10 border border-violet-500/20">
          <svg className="h-8 w-8 text-violet-400 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-black uppercase tracking-[0.2em] text-foreground">
            Signal Lost
          </h2>
          <p className="text-sm text-muted-foreground max-w-md">
            The node you are looking for does not exist or has been decommissioned.
          </p>
        </div>

        <a
          href="/"
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-background px-2.5 h-8 gap-1.5 text-sm font-medium whitespace-nowrap transition-all hover:bg-muted hover:text-foreground"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          RETURN TO BASE
        </a>
      </div>
    </div>
  );
}
