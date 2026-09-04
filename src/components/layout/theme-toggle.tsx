"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { updateThemePreference } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun, stored: "LIGHT" },
  { value: "dark", label: "Dark", icon: Moon, stored: "DARK" },
  { value: "system", label: "System", icon: Monitor, stored: "SYSTEM" },
] as const;

/**
 * The theme switcher.
 *
 * The trigger icon is chosen by CSS rather than by JavaScript — the sun is
 * hidden in dark mode and the moon in light — so the button renders identically
 * on the server and the client and there is nothing to hydrate. The menu's
 * contents only mount once it is opened, which is always on the client, so the
 * active-state tick can read the resolved theme directly.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme">
          <Sun className="size-4 dark:hidden" aria-hidden />
          <Moon className="hidden size-4 dark:block" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => {
              setTheme(option.value);
              // Remember the choice server-side too, so a new device starts here.
              void updateThemePreference(option.stored);
            }}
            className="gap-2"
          >
            <option.icon className="size-4" aria-hidden />
            {option.label}
            {theme === option.value ? (
              <>
                <Check className="ml-auto size-3.5" aria-hidden />
                <span className="sr-only">(current)</span>
              </>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
