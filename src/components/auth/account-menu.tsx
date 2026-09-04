"use client";

import { LogOut, Settings as SettingsIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Who is signed in, and the way out.
 *
 * The trigger shows initials rather than an avatar image — there are no uploads
 * — with the name and email inside, so the identity is legible without spending
 * a row of the sidebar on it.
 */
export function AccountMenu({
  name,
  email,
  align = "end",
}: {
  name: string;
  email: string;
  align?: "start" | "end";
}) {
  const [signingOut, setSigningOut] = useState(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto w-full justify-start gap-2.5 px-2 py-2"
          aria-label={`Account menu for ${name}`}
        >
          <span
            className="bg-primary/10 text-primary grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold"
            aria-hidden
          >
            {initials(name)}
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-medium">{name}</span>
            <span className="text-muted-foreground block truncate text-xs">
              {email}
            </span>
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="text-muted-foreground block truncate text-xs">
            {email}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/settings">
            <SettingsIcon className="size-4" aria-hidden />
            Settings
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/*
         * A form, not an onClick: logging out is a state change on the server,
         * so it goes through a POST that the browser can neither prefetch nor
         * replay from history.
         */}
        <form
          action={async () => {
            setSigningOut(true);
            await logoutAction();
          }}
        >
          <DropdownMenuItem asChild>
            <button
              type="submit"
              disabled={signingOut}
              className="w-full cursor-pointer"
            >
              <LogOut className="size-4" aria-hidden />
              {signingOut ? "Logging out…" : "Log out"}
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** "Aarav Shah" → "AS"; a single name → its first letter. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]!.toUpperCase();
  return (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase();
}
