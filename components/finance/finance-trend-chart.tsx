"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function FinanceTrendChart({ data }: { data: { month: string; revenue: number; expenses: number }[] }) {
  if (data.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">Not enough data yet to chart a trend.</p>;
  }
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
          <Tooltip formatter={(value) => `₹${Number(value).toLocaleString("en-IN")}`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="revenue" name="Revenue" stroke="var(--color-chart-1, #059669)" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="expenses" name="Expenses" stroke="var(--color-chart-3, #e11d48)" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
