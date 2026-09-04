"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Shared chart chrome.
 *
 * Every chart in the app is a **single series** — "hours per day", "score per
 * subject", "marks per assessment". That is deliberate: a single series needs no
 * categorical palette and therefore no legend (the heading names what is
 * plotted), identity is carried by the axis label rather than by colour, and
 * there is no colour-vision hazard to design around. Where several things must
 * be compared, they are compared as bars against one axis, never as two y-scales.
 *
 * Colours come from the `--chart-*` tokens, which are validated in both light
 * and dark mode (lightness band, chroma floor, CVD separation, contrast). Text
 * never wears a series colour.
 */

export const CHART_COLORS = {
  primary: "var(--chart-1)",
  secondary: "var(--chart-2)",
  accent: "var(--chart-3)",
  grid: "var(--border)",
  axis: "var(--muted-foreground)",
  surface: "var(--card)",
} as const;

/** Axis and grid props shared by every chart, so the chrome cannot drift. */
export const AXIS_PROPS = {
  stroke: CHART_COLORS.axis,
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

export const GRID_PROPS = {
  stroke: CHART_COLORS.grid,
  strokeWidth: 1,
  vertical: false,
} as const;

/**
 * Whole-hour tick positions for an axis measured in minutes.
 *
 * Letting Recharts choose its own ticks and formatting them as hours produces
 * duplicates — 90 and 135 minutes both round to "2h" — so the ticks are placed
 * on hour boundaries first and labelled second. The step widens as the range
 * grows so a long week does not turn into a ladder.
 */
export function hourTicks(maxMinutes: number): number[] {
  const maxHours = Math.max(1, Math.ceil(maxMinutes / 60));
  const step =
    maxHours <= 4 ? 1 : maxHours <= 10 ? 2 : maxHours <= 24 ? 4 : Math.ceil(maxHours / 6);

  const ticks: number[] = [];
  for (let hour = 0; hour <= maxHours; hour += step) ticks.push(hour * 60);

  // Always close the axis on a tick so the top gridline is labelled.
  const last = ticks[ticks.length - 1];
  if (last < maxHours * 60) ticks.push(last + step * 60);

  return ticks;
}

export const hourTickLabel = (value: number) => `${Math.round(value / 60)}h`;

/**
 * Adapts a numeric formatter to the shape Recharts' `LabelList` expects, which
 * is a wider union than a number. Returning "" suppresses the label, which is
 * how the charts keep direct labels selective.
 */
export function numericLabel(
  format: (value: number) => string,
): (value: string | number | boolean | null | undefined) => string {
  return (value) => {
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? format(numeric) : "";
  };
}

/**
 * A chart frame: heading, optional subtitle, the plot, and the same numbers as
 * text underneath.
 *
 * The text list is not decoration. Three of the light-mode chart steps sit below
 * 3:1 against the card, which makes visible labels or a table view mandatory
 * rather than optional — and it means the data is reachable without a pointer,
 * on a screen reader, and in print.
 */
export function ChartFrame({
  title,
  subtitle,
  children,
  footer,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <figure className={cn("m-0", className)}>
      <figcaption className="mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle ? (
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        ) : null}
      </figcaption>
      {children}
      {footer ? <div className="mt-3">{footer}</div> : null}
    </figure>
  );
}

/** The tooltip body: value first and loud, label second and quiet. */
export function ChartTooltipBody({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-xs shadow-md">
      <p className="tabular text-sm font-semibold">{value}</p>
      <p className="text-muted-foreground mt-0.5">{label}</p>
      {hint ? <p className="text-muted-foreground mt-0.5">{hint}</p> : null}
    </div>
  );
}

/**
 * The keyboard- and screen-reader-accessible twin of a chart: the same numbers
 * as a definition list. Rendered under every chart.
 */
export function ChartValueList({
  items,
  emptyLabel = "No data yet",
}: {
  items: readonly { label: string; value: string; muted?: boolean }[];
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-xs">{emptyLabel}</p>;
  }

  return (
    // Two columns at most: three squeezed subject names down to "Database
    // Syste…", which defeats the point of having the list at all.
    <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline justify-between gap-2">
          <dt className="text-muted-foreground truncate">{item.label}</dt>
          <dd
            className={cn(
              "tabular shrink-0 font-medium",
              item.muted && "text-muted-foreground",
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
