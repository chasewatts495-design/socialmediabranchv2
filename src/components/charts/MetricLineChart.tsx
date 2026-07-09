"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact } from "@/lib/metrics/engagement";
import { CHART, shortDate } from "./theme";

export function MetricLineChart({
  data,
  dataKey,
  color,
  label,
}: {
  data: Array<Record<string, number | string>>;
  dataKey: string;
  color: string;
  label: string;
}) {
  return (
    <div className="h-48 md:h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
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
            formatter={(value) => [Number(value).toLocaleString(), label]}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            fill={`url(#grad-${dataKey})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
