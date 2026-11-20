import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartView } from "@/lib/probability";

type Row = {
  label: string;
  actual: number;
  theory: number;
};

function ChartTip({
  active,
  payload,
  label,
  view,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ name?: string; value?: number | string }>;
  label?: string | number;
  view: ChartView;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{label}</p>
      <ul className="mt-1 space-y-1">
        {payload.map((item) => {
          const value = Number(item.value ?? 0);
          const text =
            view === "freq" ? `${value.toFixed(1)}%` : Number.isInteger(value) ? String(value) : value.toFixed(1);
          return (
            <li key={item.name} className="flex items-center justify-between gap-4 tabular-nums">
              <span className="text-muted">{item.name}</span>
              <span>{text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DistributionChart({
  labels,
  counts,
  probs,
  view,
}: {
  labels: string[];
  counts: number[];
  probs: number[];
  view: ChartView;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const n = counts.reduce((sum, value) => sum + value, 0);
  const rows: Row[] = labels.map((label, i) => {
    const count = counts[i] ?? 0;
    const p = probs[i] ?? 0;
    if (view === "freq") {
      return {
        label,
        actual: n === 0 ? 0 : (count / n) * 100,
        theory: p * 100,
      };
    }
    return { label, actual: count, theory: n * p };
  });

  const horizontal = labels.length > 8;
  const height = horizontal ? Math.min(720, 32 * labels.length + 56) : 288;
  const radius: [number, number, number, number] = horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0];

  if (!mounted) {
    return <div className="w-full" style={{ height }} />;
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          barGap={2}
          barCategoryGap={horizontal ? "18%" : "28%"}
        >
          <CartesianGrid
            vertical={horizontal}
            horizontal={!horizontal}
            stroke="var(--color-line)"
          />
          {horizontal ? (
            <>
              <XAxis
                type="number"
                domain={view === "freq" ? [0, 100] : [0, "auto"]}
                tick={{ fill: "var(--color-muted)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: number) => (view === "freq" ? `${value}%` : String(value))}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={36}
                tick={{ fill: "var(--color-ink)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--color-ink)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <YAxis
                domain={view === "freq" ? [0, 100] : [0, "auto"]}
                width={48}
                tick={{ fill: "var(--color-muted)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: number) => (view === "freq" ? `${value}%` : String(value))}
              />
            </>
          )}
          <Tooltip
            cursor={{ fill: "color-mix(in oklab, var(--color-ink) 6%, transparent)" }}
            content={<ChartTip view={view} />}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            wrapperStyle={{ fontSize: 13, paddingBottom: 8 }}
          />
          <Bar
            dataKey="actual"
            name={view === "freq" ? "实际频率" : "实际次数"}
            fill="var(--color-accent)"
            radius={n === 0 ? [0, 0, 0, 0] : radius}
            maxBarSize={42}
            isAnimationActive={false}
          />
          <Bar
            dataKey="theory"
            name={view === "freq" ? "理论概率" : "期望次数"}
            fill="var(--color-theory)"
            radius={radius}
            maxBarSize={42}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
