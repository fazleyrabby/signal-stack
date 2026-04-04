"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // If we're on the login page, don't check auth
    if (pathname === "/admin/login") {
      setIsAuthorized(true);
      return;
    }

    if (!isAdminAuthenticated()) {
      router.push("/admin/login");
    } else {
      setIsAuthorized(true);
    }
  }, [pathname, router]);

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950/20 gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
           Decrypting System Access...
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
