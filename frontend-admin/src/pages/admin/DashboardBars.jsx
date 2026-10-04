import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

// This chart is dashboard-only: one row with one series per confirmation state.
export default function DashboardBars({ data, stacked = false, label }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const row = Object.fromEntries(data.map((item, index) => [`value${index}`, item.value]));
  return <div className="dash-bars">
    {stacked && total > 0 ? <div className="dash-stack" role="img" aria-label={`${label}: ${data.map(item => `${item.label}: ${item.value}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height={42}>
        <BarChart data={[row]} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <XAxis type="number" hide domain={[0, total]} />
          <YAxis type="category" hide />
          {data.map((item, index) => <Bar key={item.label} dataKey={`value${index}`} stackId="confirmations" fill={item.color} isAnimationActive={false} barSize={36} />)}
        </BarChart>
      </ResponsiveContainer>
    </div> : null}
    <dl className={stacked ? "dash-legend" : "dash-distribution"}>
      {data.map(item => <div key={item.label}>
        <dt><i style={{ background: item.color }} />{item.label}</dt>
        <dd>{item.value}</dd>
        {!stacked ? <div className="dash-track" aria-hidden="true"><span style={{ width: `${total ? item.value / total * 100 : 0}%`, background: item.color }} /></div> : null}
      </div>)}
    </dl>
    {!total ? <p className="dash-note">No hay miembros en este conjunto de datos.</p> : null}
  </div>;
}
