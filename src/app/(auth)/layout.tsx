import Link from "next/link";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { BRAND_ICON } from "@/lib/navigation";

/**
 * The signed-out frame: brand, a centred card, and the theme toggle.
 *
 * No sidebar and no tab bar — there is nothing to navigate to yet — but the
 * same tokens, type scale and surface treatment as the app behind it, so
 * logging in feels like entering Campivo rather than arriving from somewhere
 * else.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const Brand = BRAND_ICON;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <Link
          href="/login"
          className="focus-visible:ring-ring flex items-center gap-2.5 rounded-md font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-lg">
            <Brand className="size-4.5" aria-hidden />
          </span>
          <span className="text-[0.9375rem] leading-tight">Campivo</span>
        </Link>

        <ThemeToggle />
      </header>

      <main
        id="main"
        className="flex flex-1 items-start justify-center px-4 pt-4 pb-16 sm:items-center sm:pt-0 sm:pb-24"
      >
        <div className="w-full max-w-[26rem]">{children}</div>
      </main>
    </div>
  );
}
