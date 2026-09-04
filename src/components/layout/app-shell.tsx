import Link from "next/link";
import type { ReactNode } from "react";

import { AccountMenu } from "@/components/auth/account-menu";
import { MobileNavDrawer, MobileTabBar } from "@/components/layout/mobile-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { TopBarTitle } from "@/components/layout/top-bar-title";
import { BRAND_ICON } from "@/lib/navigation";
import type { CurrentUser } from "@/lib/db/user";

/**
 * The application frame: a fixed sidebar from `lg` up, a drawer plus a bottom
 * tab bar below it. The main column is the only scroll container, so the
 * sidebar never scrolls away from a long page.
 */
export function AppShell({
  user,
  children,
}: {
  user: CurrentUser;
  children: ReactNode;
}) {
  const Brand = BRAND_ICON;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <a
        href="#main"
        className="bg-primary text-primary-foreground focus-visible:ring-ring sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-50 focus-visible:rounded-md focus-visible:px-3 focus-visible:py-2 focus-visible:text-sm"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="bg-sidebar text-sidebar-foreground hidden border-r lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-lg">
            <Brand className="size-4.5" aria-hidden />
          </span>
          <span className="text-[0.9375rem] leading-tight font-semibold">
            Campivo
          </span>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto px-3 pb-4">
          <SidebarNav />
        </div>

        {/* The signed-in student, and the way out. */}
        <div className="border-t p-2">
          <AccountMenu name={user.name} email={user.email} align="start" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-3 backdrop-blur sm:px-6">
          <MobileNavDrawer studentName={user.name} />

          <Link
            href="/"
            className="flex items-center gap-2 font-semibold lg:hidden"
          >
            <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-md">
              <Brand className="size-4" aria-hidden />
            </span>
            <span className="text-sm">Campivo</span>
          </Link>

          <TopBarTitle />

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
          </div>
        </header>

        <main
          id="main"
          className="flex-1 px-3 pt-5 pb-24 sm:px-6 sm:pt-6 lg:pb-10"
        >
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      <MobileTabBar />
    </div>
  );
}
