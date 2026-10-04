import { useMemo } from "react";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import BaseChart from "./BaseChart.jsx";
import { baseAnimation, chartColors, chartPalette, formatPercent } from "./chartTheme";

function SegmentLabel({ height, value, width, x, y, shortLabel, total }) {
  if (!total || Number(value || 0) / total < 0.16 || width < 74) return null;

  return (
    <text
      dominantBaseline="central"
      fill="#ffffff"
      fontSize={11}
      fontWeight={800}
      textAnchor="middle"
      x={x + width / 2}
      y={y + height / 2}
    >
      {shortLabel} {formatPercent(value, total)}
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

export default function SegmentedAttendanceBar({ ariaLabel, data, height = 104 }) {
  const total = useMemo(() => data.reduce((sum, item) => sum + Number(item.value || 0), 0), [data]);
  const chartData = useMemo(
    () =>
      data.map((item, index) => ({
        ...item,
        color: item.color || chartColors[index % chartColors.length],
        shortLabel: item.shortLabel || item.label,
      })),
    [data],
  );

  return (
    <div className="segmented-chart-block">
      <BaseChart ariaLabel={ariaLabel} className="segmented-rechart" height={height}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ bottom: 10, left: 0, right: 0, top: 16 }}>
            <XAxis dataKey="value" domain={[0, total || 1]} hide type="number" />
            <YAxis dataKey="label" hide type="category" />
            <Tooltip content={<ChartTooltip total={total} />} cursor={{ fill: "transparent" }} />
            <Bar
              {...baseAnimation}
              background={{ fill: chartPalette.surfaceMuted, radius: 8 }}
              barSize={30}
              dataKey="value"
              isAnimationActive
              radius={[8, 8, 8, 8]}
            >
              {chartData.map((item) => (
                <Cell fill={item.color} key={item.label} />
              ))}
              <LabelList content={(props) => <SegmentLabel {...props} total={total} />} dataKey="value" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </BaseChart>
      <div className="chart-legend-list">
        {chartData.map((item) => (
          <span key={item.label}>
            <i style={{ background: item.color }} />
            {item.label}: <strong>{item.value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
