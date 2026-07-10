"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PlatformId } from "@/lib/connectors/types";
import { PLATFORM_CHART_COLORS, PLATFORM_LABELS } from "@/lib/metrics/colors";
import { CHART } from "./theme";

export function EngagementBarChart({
  data,
}: {
  data: { platformId: PlatformId; er: number | null }[];
}) {
  const rows = data
    .filter((d) => d.er != null)
    .map((d) => ({
      name: PLATFORM_LABELS[d.platformId],
      platformId: d.platformId,
      er: Number(d.er!.toFixed(2)),
    }))
    .sort((a, b) => b.er - a.er);

  return (
    <div className="h-56 md:h-72" data-testid="engagement-bars">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 0, right: 36, bottom: 0, left: 8 }}
          barCategoryGap="28%"
        >
          <CartesianGrid stroke={CHART.grid} horizontal={false} />
          <XAxis
            type="number"
            tick={CHART.tick}
            axisLine={false}
            tickLine={false}
            unit="%"
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={CHART.tick}
            axisLine={false}
            tickLine={false}
            width={72}
          />
          <Tooltip
            {...CHART.tooltip}
            cursor={{ fill: "#e3e7ee99" }}
            formatter={(value) => [`${value}%`, "Engagement rate"]}
          />
          <Bar dataKey="er" maxBarSize={18} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <LabelList
              dataKey="er"
              position="right"
              formatter={(v) => `${String(v)}%`}
              style={{ fill: "#5b6472", fontSize: 11 }}
            />
            {rows.map((r) => (
              <Cell
                key={r.platformId}
                fill={PLATFORM_CHART_COLORS[r.platformId]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
