"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";

const NO_CHROME_ROUTES = ["/login", "/totp"];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (NO_CHROME_ROUTES.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <main className="flex-1 overflow-x-auto p-6">{children}</main>
    </div>
  );
}
