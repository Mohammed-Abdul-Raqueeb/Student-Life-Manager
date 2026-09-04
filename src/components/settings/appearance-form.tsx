"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { updateThemePreference } from "@/actions/settings";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";

const OPTIONS = [
  {
    value: "light",
    stored: "LIGHT",
    label: "Light",
    icon: Sun,
    description: "Always light.",
  },
  {
    value: "dark",
    stored: "DARK",
    label: "Dark",
    icon: Moon,
    description: "Always dark.",
  },
  {
    value: "system",
    stored: "SYSTEM",
    label: "System",
    icon: Monitor,
    description: "Follow your device.",
  },
] as const;

/**
 * Theme choice.
 *
 * Applied instantly in the browser by `next-themes` and persisted to the
 * database so a different device starts from the same preference. Rendered as a
 * radio group rather than a toggle, because "system" is a third state, not the
 * absence of a choice.
 */
export function AppearanceForm({ initial }: { initial: string }) {
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();

  // Before hydration the browser preference is unknown, so both server and
  // client render the value stored in the database.
  const value = hydrated ? (theme ?? initial.toLowerCase()) : initial.toLowerCase();

  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => {
        setTheme(next);
        const option = OPTIONS.find((o) => o.value === next);
        if (!option) return;
        void updateThemePreference(option.stored).then((result) => {
          if (result.status === "error") toast.error(result.message);
        });
      }}
      className="grid gap-3 sm:grid-cols-3"
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const selected = value === option.value;

        return (
          <Label
            key={option.value}
            htmlFor={`theme-${option.value}`}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
              selected ? "border-primary bg-accent/50" : "hover:bg-muted/50",
            )}
          >
            <RadioGroupItem
              id={`theme-${option.value}`}
              value={option.value}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 font-medium">
                <Icon className="size-4" aria-hidden />
                {option.label}
              </span>
              <span className="text-muted-foreground mt-0.5 block text-xs font-normal">
                {option.description}
              </span>
            </span>
          </Label>
        );
      })}
    </RadioGroup>
  );
}
