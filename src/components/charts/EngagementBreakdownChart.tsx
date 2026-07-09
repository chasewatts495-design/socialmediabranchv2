"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact } from "@/lib/metrics/engagement";
import { CHART, shortDate } from "./theme";

const SERIES = [
  { key: "likes", label: "Likes", color: "#3d87f5" },
  { key: "comments", label: "Comments", color: "#0095b0" },
  { key: "shares", label: "Shares", color: "#8b5cf6" },
  { key: "saves", label: "Saves", color: "#cc2957" },
] as const;

export function EngagementBreakdownChart({
  data,
}: {
  data: Array<Record<string, number | string>>;
}) {
  return (
    <div>
      <div className="mb-3 flex gap-3 overflow-x-auto px-1 text-[11px] text-muted">
        {SERIES.map((s) => (
          <span key={s.key} className="flex shrink-0 items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="h-48 md:h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
            barCategoryGap="35%"
          >
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={CHART.tick}
              axisLine={{ stroke: CHART.axisLine }}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              tick={CHART.tick}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => formatCompact(v)}
              width={44}
            />
            <Tooltip
              {...CHART.tooltip}
              cursor={{ fill: "#1a213066" }}
              labelFormatter={(l) => shortDate(String(l))}
              formatter={(value, name) => [
                Number(value).toLocaleString(),
                SERIES.find((s) => s.key === name)?.label ?? String(name),
              ]}
            />
            {SERIES.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId="eng"
                fill={s.color}
                isAnimationActive={false}
                radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
