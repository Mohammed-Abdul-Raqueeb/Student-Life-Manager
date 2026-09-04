"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
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
  numericLabel,
} from "@/components/charts/chart-primitives";

type SubjectScorePoint = {
  code: string;
  name: string;
  score: number;
  grade: string | null;
};

type AssessmentPoint = {
  name: string;
  percent: number;
  detail: string;
};

const percentTick = (value: number) => `${value}%`;

/**
 * Score per subject against the credit-weighted average.
 *
 * One measure, one axis, one colour: the reference line is the comparison, not a
 * second series. Bars below the average are drawn at reduced opacity so the
 * split is visible without introducing a second hue.
 */
export function SubjectScoreChart({
  data,
  average,
}: {
  data: readonly SubjectScorePoint[];
  average: number | null;
}) {
  const height = Math.max(160, data.length * 44 + 24);

  return (
    <ChartFrame
      title="Score by subject"
      subtitle={
        average === null
          ? "Current score in each subject."
          : `Current score in each subject. The line marks your ${average.toFixed(1)}% credit-weighted average.`
      }
      footer={
        <ChartValueList
          items={data.map((d) => ({
            label: d.name,
            value: `${d.score.toFixed(1)}%${d.grade ? ` · ${d.grade}` : ""}`,
          }))}
          emptyLabel="No marks recorded yet."
        />
      }
    >
      {data.length === 0 ? (
        <p className="text-muted-foreground border-muted-foreground/20 rounded-lg border border-dashed px-4 py-10 text-center text-sm">
          Record some marks to see this chart.
        </p>
      ) : (
        <div style={{ height }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data as SubjectScorePoint[]}
              layout="vertical"
              margin={{ top: 0, right: 52, bottom: 0, left: 0 }}
              barCategoryGap="26%"
            >
              <CartesianGrid {...GRID_PROPS} vertical horizontal={false} />
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis type="category" dataKey="code" width={64} {...AXIS_PROPS} />
              {average !== null ? (
                <ReferenceLine
                  x={average}
                  stroke={CHART_COLORS.axis}
                  strokeWidth={1}
                />
              ) : null}
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <ChartTooltipBody
                      label={String(payload[0].payload.name)}
                      value={`${Number(payload[0].value).toFixed(1)}%`}
                      hint={payload[0].payload.grade ?? undefined}
                    />
                  ) : null
                }
              />
              <Bar
                dataKey="score"
                maxBarSize={24}
                radius={[0, 4, 4, 0]}
                fill={CHART_COLORS.primary}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="score"
                  position="right"
                  offset={8}
                  fill="var(--foreground)"
                  fontSize={11}
                  formatter={numericLabel((value) => `${value.toFixed(0)}%`)}
                />
                {data.map((entry) => (
                  <Cell
                    key={entry.code}
                    fill={CHART_COLORS.primary}
                    fillOpacity={
                      average !== null && entry.score < average ? 0.45 : 1
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartFrame>
  );
}

/** Every assessment in one subject, oldest first, as a percentage. */
export function AssessmentBreakdownChart({
  data,
  subjectName,
}: {
  data: readonly AssessmentPoint[];
  subjectName: string;
}) {
  const best = Math.max(...data.map((d) => d.percent), 0);

  return (
    <ChartFrame
      title="Assessment breakdown"
      subtitle={`Every recorded assessment in ${subjectName}, oldest first.`}
      footer={
        <ChartValueList
          items={data.map((d) => ({
            label: d.name,
            value: `${d.percent.toFixed(1)}%`,
          }))}
          emptyLabel="No assessments recorded yet."
        />
      }
    >
      {data.length === 0 ? (
        <p className="text-muted-foreground border-muted-foreground/20 rounded-lg border border-dashed px-4 py-10 text-center text-sm">
          Record marks for this subject to see the breakdown.
        </p>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data as AssessmentPoint[]}
              margin={{ top: 18, right: 8, bottom: 0, left: -18 }}
              barCategoryGap="24%"
            >
              <CartesianGrid {...GRID_PROPS} />
              <XAxis
                dataKey="name"
                {...AXIS_PROPS}
                interval={0}
                tickFormatter={(value: string) =>
                  value.length > 12 ? `${value.slice(0, 11)}…` : value
                }
              />
              <YAxis
                {...AXIS_PROPS}
                width={40}
                domain={[0, 100]}
                tickFormatter={percentTick}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <ChartTooltipBody
                      label={String(payload[0].payload.name)}
                      value={`${Number(payload[0].value).toFixed(1)}%`}
                      hint={String(payload[0].payload.detail)}
                    />
                  ) : null
                }
              />
              <Bar
                dataKey="percent"
                maxBarSize={24}
                radius={[4, 4, 0, 0]}
                fill={CHART_COLORS.primary}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="percent"
                  position="top"
                  offset={8}
                  fill="var(--foreground)"
                  fontSize={11}
                  formatter={numericLabel((value) =>
                    value === best ? `${value.toFixed(0)}%` : "",
                  )}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartFrame>
  );
}
