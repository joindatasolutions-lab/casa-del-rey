export const chartPalette = {
  ink: "#142132",
  muted: "#6f6a66",
  line: "#e5ded6",
  surfaceMuted: "#f4eee7",
  primary: "#245b45",
  primarySoft: "#86b9a4",
  green: "#245b45",
  greenSoft: "#86b9a4",
  yellow: "#d9a441",
  yellowSoft: "#efd48d",
  red: "#a33c3c",
  redSoft: "#d798a3",
  slate: "#7f8a92",
};

export const chartColors = [
  chartPalette.green,
  chartPalette.yellow,
  chartPalette.red,
  chartPalette.greenSoft,
  chartPalette.yellowSoft,
  chartPalette.redSoft,
];

export const chartTextStyle = {
  color: chartPalette.ink,
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
};

export const baseTooltip = {
  backgroundColor: "#ffffff",
  borderColor: chartPalette.line,
  borderRadius: 8,
  padding: [10, 12],
  textStyle: {
    ...chartTextStyle,
    fontSize: 12,
    fontWeight: 700,
  },
};

export const baseAnimation = {
  animationDuration: 700,
  animationEasing: "ease-out",
};

export function formatPercent(value, total) {
  if (!total) return "0%";
  return `${Math.round((Number(value || 0) / total) * 100)}%`;
}
