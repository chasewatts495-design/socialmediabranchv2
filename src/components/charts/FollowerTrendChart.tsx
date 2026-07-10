"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PlatformId } from "@/lib/connectors/types";
import { PLATFORM_CHART_COLORS, PLATFORM_LABELS } from "@/lib/metrics/colors";
import { formatCompact } from "@/lib/metrics/engagement";
import { CHART, shortDate } from "./theme";

export function FollowerTrendChart({
  data,
  platforms,
}: {
  data: Array<Record<string, number | string>>;
  platforms: PlatformId[];
}) {
  return (
    <div>
      {/* Legend: identity never rides on color alone */}
      <div className="mb-3 flex gap-3 overflow-x-auto px-1 pb-1 text-[11px] text-muted">
        {platforms.map((p) => (
          <span key={p} className="flex shrink-0 items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: PLATFORM_CHART_COLORS[p] }}
            />
            {PLATFORM_LABELS[p]}
          </span>
        ))}
      </div>
      <div className="h-56 md:h-72" data-testid="follower-trend">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
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
              labelFormatter={(l) => shortDate(String(l))}
              formatter={(value, name) => [
                Number(value).toLocaleString(),
                PLATFORM_LABELS[name as PlatformId] ?? String(name),
              ]}
              itemSorter={(item) => -Number(item.value ?? 0)}
            />
            {platforms.map((p) => (
              <Line
                key={p}
                type="monotone"
                dataKey={p}
                stroke={PLATFORM_CHART_COLORS[p]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
