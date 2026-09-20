"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function ExpenseBreakdownChart({ data }: { data: { name: string; amount: number }[] }) {
  if (data.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">No expenses recorded yet.</p>;
  }
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
          <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Spent"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Bar dataKey="amount" fill="var(--color-chart-3, #e11d48)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
