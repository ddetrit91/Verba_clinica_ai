"use client";

import { usePathname } from "next/navigation";

export function SiteFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/tg" || pathname.startsWith("/tg/")) return null;
  return children;
}
