"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  AXIS_PROPS,
  CHART_COLORS,
  ChartFrame,
  ChartTooltipBody,
  ChartValueList,
  GRID_PROPS,
  hourTickLabel,
  hourTicks,
  numericLabel,
} from "@/components/charts/chart-primitives";
import { formatDuration } from "@/lib/date";

type DayPoint = { label: string; minutes: number };
type SubjectPoint = { label: string; code: string; minutes: number };
type TrendPoint = { label: string; minutes: number };

/** Hours per day this week. One series, so the heading carries the identity. */
export function StudyByDayChart({
  data,
  goalMinutesPerDay,
}: {
  data: readonly DayPoint[];
  goalMinutesPerDay?: number;
}) {
  const peak = Math.max(...data.map((d) => d.minutes), 0);
  const ticks = hourTicks(Math.max(peak, goalMinutesPerDay ?? 0));

  return (
    <ChartFrame
      title="Study hours by day"
      subtitle="This week, Monday to Sunday."
      footer={
        <ChartValueList
          items={data.map((d) => ({
            label: d.label,
            value: d.minutes > 0 ? formatDuration(d.minutes) : "—",
            muted: d.minutes === 0,
          }))}
        />
      }
    >
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data as DayPoint[]}
            margin={{ top: 18, right: 8, bottom: 0, left: -18 }}
            barCategoryGap="22%"
          >
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="label" {...AXIS_PROPS} />
            <YAxis
              {...AXIS_PROPS}
              width={44}
              ticks={ticks}
              domain={[0, ticks[ticks.length - 1]]}
              tickFormatter={hourTickLabel}
            />
            {goalMinutesPerDay && goalMinutesPerDay > 0 ? (
              <ReferenceLine
                y={goalMinutesPerDay}
                stroke={CHART_COLORS.axis}
                strokeWidth={1}
                label={{
                  value: "daily pace",
                  position: "insideTopRight",
                  fill: "var(--muted-foreground)",
                  fontSize: 10,
                }}
              />
            ) : null}
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <ChartTooltipBody
                    label={String(label)}
                    value={formatDuration(Number(payload[0].value))}
                  />
                ) : null
              }
            />
            <Bar
              dataKey="minutes"
              maxBarSize={24}
              radius={[4, 4, 0, 0]}
              fill={CHART_COLORS.primary}
              isAnimationActive={false}
            >
              {/* Label only the peak — a number on every bar reads as noise. */}
              <LabelList
                dataKey="minutes"
                position="top"
                offset={8}
                fill="var(--foreground)"
                fontSize={11}
                formatter={numericLabel((value) =>
                  value > 0 && value === peak ? formatDuration(value) : "",
                )}
              />
              {data.map((entry) => (
                <Cell
                  key={entry.label}
                  fill={CHART_COLORS.primary}
                  fillOpacity={entry.minutes === 0 ? 0.25 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

/**
 * Hours per subject. Horizontal, because subject names are long and a rotated
 * x-axis label is unreadable. Identity lives in the axis label, not in colour.
 */
export function StudyBySubjectChart({ data }: { data: readonly SubjectPoint[] }) {
  const height = Math.max(150, data.length * 40 + 24);

  return (
    <ChartFrame
      title="Study hours by subject"
      subtitle="This week."
      footer={
        <ChartValueList
          items={data.map((d) => ({
            label: d.label,
            value: formatDuration(d.minutes),
          }))}
          emptyLabel="No sessions logged this week."
        />
      }
    >
      {data.length === 0 ? (
        <p className="text-muted-foreground border-muted-foreground/20 rounded-lg border border-dashed px-4 py-10 text-center text-sm">
          Nothing logged this week yet.
        </p>
      ) : (
        <div style={{ height }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data as SubjectPoint[]}
              layout="vertical"
              margin={{ top: 0, right: 56, bottom: 0, left: 0 }}
              barCategoryGap="26%"
            >
              <CartesianGrid {...GRID_PROPS} vertical horizontal={false} />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="code" width={64} {...AXIS_PROPS} />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <ChartTooltipBody
                      label={String(payload[0].payload.label)}
                      value={formatDuration(Number(payload[0].value))}
                    />
                  ) : null
                }
              />
              <Bar
                dataKey="minutes"
                maxBarSize={24}
                radius={[0, 4, 4, 0]}
                fill={CHART_COLORS.primary}
                isAnimationActive={false}
              >
                {/* The right margin reserves room for every label, so none is
                    clipped and no value is gated behind a hover. */}
                <LabelList
                  dataKey="minutes"
                  position="right"
                  offset={8}
                  fill="var(--foreground)"
                  fontSize={11}
                  formatter={numericLabel(formatDuration)}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartFrame>
  );
}

/** Weekly totals over the last six weeks. */
export function StudyTrendChart({
  data,
  goalMinutes,
}: {
  data: readonly TrendPoint[];
  goalMinutes: number;
}) {
  const last = data.at(-1);
  const ticks = hourTicks(
    Math.max(...data.map((d) => d.minutes), goalMinutes, 0),
  );

  return (
    <ChartFrame
      title="Weekly trend"
      subtitle="Total hours per week over the last six weeks."
      footer={
        <ChartValueList
          items={data.map((d) => ({
            label: `Week of ${d.label}`,
            value: d.minutes > 0 ? formatDuration(d.minutes) : "—",
            muted: d.minutes === 0,
          }))}
        />
      }
    >
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data as TrendPoint[]}
            margin={{ top: 18, right: 24, bottom: 0, left: -18 }}
          >
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="label" {...AXIS_PROPS} />
            <YAxis
              {...AXIS_PROPS}
              width={44}
              ticks={ticks}
              domain={[0, ticks[ticks.length - 1]]}
              tickFormatter={hourTickLabel}
            />
            {goalMinutes > 0 ? (
              <ReferenceLine
                y={goalMinutes}
                stroke={CHART_COLORS.axis}
                strokeWidth={1}
                label={{
                  value: "goal",
                  position: "insideTopRight",
                  fill: "var(--muted-foreground)",
                  fontSize: 10,
                }}
              />
            ) : null}
            <Tooltip
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <ChartTooltipBody
                    label={`Week of ${label}`}
                    value={formatDuration(Number(payload[0].value))}
                  />
                ) : null
              }
            />
            <Line
              type="monotone"
              dataKey="minutes"
              stroke={CHART_COLORS.primary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              isAnimationActive={false}
              dot={{
                r: 4,
                fill: CHART_COLORS.primary,
                stroke: CHART_COLORS.surface,
                strokeWidth: 2,
              }}
              activeDot={{
                r: 5,
                fill: CHART_COLORS.primary,
                stroke: CHART_COLORS.surface,
                strokeWidth: 2,
              }}
            >
              {/* Only the current week is labelled — the story is "where am I now". */}
              <LabelList
                dataKey="minutes"
                position="top"
                offset={10}
                fill="var(--foreground)"
                fontSize={11}
                formatter={numericLabel((value) =>
                  last && value === last.minutes && value > 0
                    ? formatDuration(value)
                    : "",
                )}
              />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
