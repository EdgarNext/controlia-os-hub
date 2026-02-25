"use client";

import { useSyncExternalStore } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LabPoint } from "../lib/types";

function subscribe() {
  return () => {};
}

export function ChartDemo({ data }: { data: LabPoint[] }) {
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);

  if (!isClient) {
    return <div className="h-64 w-full animate-pulse rounded-[var(--radius-base)] bg-surface-2" />;
  }

  return (
    <div className="h-64 w-full rounded-[var(--radius-base)] border border-border bg-surface p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" />
          <XAxis dataKey="name" stroke="var(--muted)" />
          <YAxis stroke="var(--muted)" />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-base)",
              color: "var(--foreground)",
            }}
          />
          <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
