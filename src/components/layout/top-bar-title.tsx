"use client";

import { usePathname } from "next/navigation";

import { activeNavItem } from "@/lib/navigation";

/**
 * The current section name in the top bar. Hidden on mobile, where the brand
 * mark and the bottom tab bar already say where you are.
 */
export function TopBarTitle() {
  const pathname = usePathname();
  const item = activeNavItem(pathname);

  if (!item) return null;

  return (
    <div className="hidden min-w-0 lg:block">
      <p className="truncate text-sm font-semibold">{item.label}</p>
      <p className="text-muted-foreground truncate text-xs">
        {item.description}
      </p>
    </div>
  );
}
