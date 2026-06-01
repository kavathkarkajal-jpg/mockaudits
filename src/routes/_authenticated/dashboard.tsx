import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getDashboard } from "@/lib/api/mock-audit.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: DashboardPage });

function DashboardPage() {
  const fetch = useServerFn(getDashboard);
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => fetch() });
  const [brandFilter, setBrandFilter] = useState<string>("all");

  const filteredBrands = useMemo(
    () => (brandFilter === "all" ? data?.brandStats ?? [] : (data?.brandStats ?? []).filter((b) => b.brand_id === brandFilter)),
    [data, brandFilter],
  );
  const filteredStores = useMemo(
    () => (brandFilter === "all" ? data?.storeStats ?? [] : (data?.storeStats ?? []).filter((s) => s.brand_id === brandFilter)),
    [data, brandFilter],
  );
  const summary = useMemo(() => {
    if (brandFilter === "all") return data?.summary;
    const due = filteredBrands.reduce((a, b) => a + b.due, 0);
    const completed = filteredBrands.reduce((a, b) => a + b.completed, 0);
    return {
      totalDue: due, totalCompleted: completed,
      totalPending: Math.max(due - completed, 0),
      pct: due ? Math.round((completed / due) * 100) : 0,
    };
  }, [data, brandFilter, filteredBrands]);

  if (isLoading || !data) return <div className="text-sm text-muted-foreground">Loading dashboard…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Week starting {data.monday}</p>
        </div>
        <Select value={brandFilter} onValueChange={setBrandFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="All brands"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All brands</SelectItem>
            {data.brandStats.map((b) => <SelectItem key={b.brand_id} value={b.brand_id}>{b.brand_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Audits Due" value={summary?.totalDue ?? 0}/>
        <Stat label="Completed" value={summary?.totalCompleted ?? 0} tone="success"/>
        <Stat label="Pending" value={summary?.totalPending ?? 0} tone="warning"/>
        <Stat label="% Complete" value={`${summary?.pct ?? 0}%`} tone="accent"/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Brand-wise completion (this week)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={filteredBrands} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
              <XAxis type="number" allowDecimals={false}/>
              <YAxis type="category" dataKey="brand_name" width={120}/>
              <Tooltip/>
              <Bar dataKey="completed" stackId="a" fill="oklch(0.55 0.16 255)" name="Completed"/>
              <Bar dataKey="pending" stackId="a" fill="oklch(0.78 0.16 75)" name="Pending"/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Week-on-week completion %">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3}/>
              <XAxis dataKey="week" tickFormatter={(w) => w.slice(5)}/>
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`}/>
              <Tooltip formatter={(v: number) => `${v}%`}/>
              <Line type="monotone" dataKey="pct" stroke="oklch(0.72 0.13 195)" strokeWidth={2.5} dot/>
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Store-by-store breakdown">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground border-b">
              <tr><th className="py-2 pr-4">Store</th><th className="py-2 pr-4">Code</th><th className="py-2 pr-4">Region</th><th className="py-2 pr-4 text-right">Due</th><th className="py-2 pr-4 text-right">Done</th><th className="py-2 pr-4 text-right">%</th></tr>
            </thead>
            <tbody>
              {filteredStores.map((s) => (
                <tr key={s.store_id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{s.store_name}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{s.store_code}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{s.region}</td>
                  <td className="py-2 pr-4 text-right">{s.due}</td>
                  <td className="py-2 pr-4 text-right">{s.completed}</td>
                  <td className="py-2 pr-4 text-right font-semibold">{s.pct}%</td>
                </tr>
              ))}
              {filteredStores.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No stores in scope.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "success" | "warning" | "accent" }) {
  const color =
    tone === "success" ? "text-[oklch(0.45_0.12_150)]" :
    tone === "warning" ? "text-[oklch(0.50_0.14_75)]" :
    tone === "accent" ? "text-[oklch(0.55_0.16_255)]" : "text-foreground";
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-sm font-medium mb-3">{title}</div>
      {children}
    </div>
  );
}
