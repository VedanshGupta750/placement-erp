"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FunnelStage } from "@/lib/dashboard/get-funnel-data";

const BAR_COLORS = ["#8b5cf6", "#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ec4899"];

export function PlacementFunnelCard({ stages }: { stages: FunnelStage[] }) {
  const data = stages.map((s) => ({ name: s.label, value: s.value, pctOfPrevious: s.pctOfPrevious }));

  return (
    <Card className="flex h-[26rem] flex-col">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Placement Funnel</CardTitle>
        <span className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-xs font-medium">This Year</span>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 w-full flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={88} />
              <Tooltip
                formatter={(value, _name, item) => {
                  const pct = item.payload.pctOfPrevious;
                  return [`${value}${pct !== null ? ` (${pct}% of previous)` : ""}`, "Students"];
                }}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
                {data.map((_, index) => (
                  <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                ))}
                <LabelList dataKey="value" position="right" style={{ fontSize: 12, fontWeight: 600, fill: "var(--foreground)" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <Link href="/reports" className="mt-2 block text-center text-sm font-medium text-primary hover:underline">
          View Funnel Report
        </Link>
      </CardContent>
    </Card>
  );
}
