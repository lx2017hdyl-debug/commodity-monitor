"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ChartPoint {
  date: string;
  price: number;
  isForecast?: boolean;
}

interface PriceChartProps {
  data: ChartPoint[];
  unit: string;
  showForecast?: boolean;
}

/** 历史价格与预测图表 */
export function PriceChart({ data, unit, showForecast = false }: PriceChartProps) {
  const chartData = data.map((d) => ({
    date: d.date.slice(5),
    历史价格: d.isForecast ? null : d.price,
    趋势预测: d.isForecast ? d.price : showForecast ? d.price : null,
  }));

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} />
          <YAxis
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            domain={["auto", "auto"]}
            tickFormatter={(v) => Number(v).toLocaleString("zh-CN")}
          />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: 8,
            }}
            labelStyle={{ color: "#e2e8f0" }}
            formatter={(value) => {
              const num = typeof value === "number" ? value : Number(value);
              return Number.isFinite(num)
                ? [`${num.toLocaleString("zh-CN")} ${unit}`, ""]
                : ["—", ""];
            }}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="历史价格"
            stroke="#f59e0b"
            fill="url(#priceFill)"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
          {showForecast && (
            <Line
              type="monotone"
              dataKey="趋势预测"
              stroke="#60a5fa"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
