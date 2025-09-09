"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { supabase, SUPABASE_CONFIGURED } from "@/lib/supabase";

export function LayoutBody({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthRoute = pathname === "/login" || pathname === "/signup" || pathname?.startsWith("/auth");

  // Client-side auth gate: redirect unauthenticated users to /login
  useEffect(() => {
    if (isAuthRoute || !SUPABASE_CONFIGURED) return;
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
    });
  }, [isAuthRoute, router]);

  if (isAuthRoute) {
    // Render children without the app sidebar/shell for auth pages
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
