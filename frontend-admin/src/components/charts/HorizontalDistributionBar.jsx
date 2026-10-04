import { useMemo } from "react";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import BaseChart from "./BaseChart.jsx";
import { baseAnimation, chartColors, chartPalette, formatPercent } from "./chartTheme";

function ValueLabel({ value, x, y, width, total }) {
  return (
    <text fill={chartPalette.ink} fontSize={12} fontWeight={800} x={x + width + 8} y={y + 12}>
      {value} ({formatPercent(value, total)})
    </text>
  );
}

function ChartTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;

  return (
    <div className="chart-tooltip">
      <span>{item.label}</span>
      <strong>
        {item.value} ({formatPercent(item.value, total)})
      </strong>
    </div>
  );
}

export default function HorizontalDistributionBar({ ariaLabel, data, height = 220 }) {
  const sortedData = useMemo(
    () =>
      [...data]
        .sort((first, second) => second.value - first.value)
        .map((item, index) => ({ ...item, color: item.color || chartColors[index % chartColors.length] })),
    [data],
  );
  const total = useMemo(() => sortedData.reduce((sum, item) => sum + Number(item.value || 0), 0), [sortedData]);

  return (
    <BaseChart ariaLabel={ariaLabel} height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sortedData} layout="vertical" margin={{ bottom: 8, left: 4, right: 58, top: 8 }}>
          <XAxis
            allowDecimals={false}
            axisLine={false}
            stroke={chartPalette.line}
            tick={{ fill: chartPalette.muted, fontSize: 11 }}
            tickLine={false}
            type="number"
          />
          <YAxis
            axisLine={false}
            dataKey="label"
            tick={{ fill: chartPalette.ink, fontSize: 12, fontWeight: 800 }}
            tickLine={false}
            type="category"
            width={86}
          />
          <Tooltip content={<ChartTooltip total={total} />} cursor={{ fill: "rgba(20, 33, 50, 0.04)" }} />
          <Bar {...baseAnimation} barSize={16} dataKey="value" isAnimationActive radius={[0, 8, 8, 0]}>
            {sortedData.map((item) => (
              <Cell fill={item.color} key={item.label} />
            ))}
            <LabelList content={(props) => <ValueLabel {...props} total={total} />} dataKey="value" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </BaseChart>
  );
}
