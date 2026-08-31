"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAdminAccessStatus } from "@/lib/admin-status";

const PUBLIC_ROUTES = ["/login", "/totp"];

/**
 * Единственная точка, которая знает про три уровня допуска (см.
 * lib/admin-status.ts) и решает, куда перенаправить: /login, /totp или
 * пропустить дальше. /login и /totp сами себя не гейтят — иначе
 * бесконечный редирект.
 */
export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const status = useAdminAccessStatus();
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    if (isPublicRoute) return;
    if (status.state === "signedOut") router.replace("/login");
    if (status.state === "needs2fa") router.replace("/totp");
    if (status.state === "notAnAdmin") router.replace("/login?error=not_admin");
  }, [status.state, isPublicRoute, router]);

  if (isPublicRoute) return <>{children}</>;

  if (status.state !== "ready") {
    return <p className="p-6 text-sm text-[var(--color-muted-foreground)]">Загрузка…</p>;
  }

  return <>{children}</>;
}
