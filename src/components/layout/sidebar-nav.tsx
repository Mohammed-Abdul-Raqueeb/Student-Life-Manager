"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  isActivePath,
  NAV_ITEMS,
  SETTINGS_ITEM,
  type NavItem,
} from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <SidebarLink
          key={item.href}
          item={item}
          active={isActivePath(pathname, item.href)}
          onNavigate={onNavigate}
        />
      ))}

      <hr className="border-sidebar-border my-3" />

      <SidebarLink
        item={SETTINGS_ITEM}
        active={isActivePath(pathname, SETTINGS_ITEM.href)}
        onNavigate={onNavigate}
      />
    </nav>
  );
}

function SidebarLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          active ? "text-sidebar-primary" : "text-muted-foreground/80",
        )}
        aria-hidden
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
