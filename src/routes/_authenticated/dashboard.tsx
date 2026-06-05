import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getDashboard } from "@/lib/api/mock-audit.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Activity, AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, ClipboardList,
  Clock, Filter, Percent, TrendingUp,
} from "lucide-react";

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
    const flagged = filteredBrands.reduce((a, b) => a + (b.flagged ?? 0), 0);
    return {
      totalDue: due, totalCompleted: completed,
      totalPending: Math.max(due - completed, 0),
      totalFlagged: flagged,
      pct: due ? Math.round((completed / due) * 100) : 0,
    };
  }, [data, brandFilter, filteredBrands]);

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Activity className="size-4 animate-pulse" /> Loading dashboard…
      </div>
    );
  }

  const pct = summary?.pct ?? 0;
  const selectedBrandName =
    brandFilter === "all" ? "All brands" : data.brandStats.find((b) => b.brand_id === brandFilter)?.brand_name ?? "Brand";

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-[oklch(0.22_0.06_255)] via-[oklch(0.26_0.07_258)] to-[oklch(0.32_0.09_262)] text-white shadow-lg">
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, oklch(0.85 0.10 200 / 0.35) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="absolute -right-20 -top-20 size-64 rounded-full bg-[oklch(0.72_0.13_195)]/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6 p-6 md:p-8">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
              <CalendarDays className="size-3.5" /> Week starting {data.monday}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Operations Dashboard</h1>
            <p className="text-sm text-white/70 max-w-md">
              Live overview of audit completion, performance trends and re-audit risk across {selectedBrandName.toLowerCase()}.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-white/60">
              <Filter className="size-3.5" /> Brand filter
            </div>
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="w-60 bg-white/10 border-white/20 text-white backdrop-blur hover:bg-white/15">
                <SelectValue placeholder="All brands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All brands</SelectItem>
                {data.brandStats.map((b) => (
                  <SelectItem key={b.brand_id} value={b.brand_id}>{b.brand_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* KPI summary */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Hero KPI: % Complete */}
        <HeroKpi
          pct={pct}
          completed={summary?.totalCompleted ?? 0}
          due={summary?.totalDue ?? 0}
        />

        {/* Supporting KPIs */}
        <div className="grid grid-cols-3 gap-4 lg:col-span-2">
          <MiniKpi
            label="Audits Due"
            value={summary?.totalDue ?? 0}
            icon={<ClipboardList className="size-4" />}
            tone="neutral"
            caption="Scheduled this week"
          />
          <MiniKpi
            label="Completed"
            value={summary?.totalCompleted ?? 0}
            icon={<CheckCircle2 className="size-4" />}
            tone="success"
            caption={`${pct}% of total`}
          />
          <MiniKpi
            label="Pending"
            value={summary?.totalPending ?? 0}
            icon={<Clock className="size-4" />}
            tone="warning"
            caption={(summary?.totalPending ?? 0) === 0 ? "All clear" : "Still to audit"}
          />
        </div>
      </section>

      {/* Re-audit banner */}
      {(summary?.totalFlagged ?? 0) > 0 && (
        <section className="relative overflow-hidden rounded-2xl border border-destructive/40 bg-gradient-to-r from-destructive/10 via-destructive/5 to-transparent p-5">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
              <AlertTriangle className="size-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-destructive tabular-nums">{summary?.totalFlagged}</span>
                <span className="font-semibold text-foreground">re-audit{(summary?.totalFlagged ?? 0) === 1 ? "" : "s"} required this week</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                These employees scored below the brand threshold. Head to <span className="font-medium text-foreground">Conduct</span> to start their re-audit.
              </p>
            </div>
            <ArrowRight className="hidden sm:block size-5 text-destructive/60 self-center" />
          </div>
        </section>
      )}

      {/* Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel
          title="Brand-wise completion"
          subtitle="This week, stacked by status"
          icon={<ClipboardList className="size-4" />}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={filteredBrands} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="oklch(0.50 0.03 255)" />
              <YAxis type="category" dataKey="brand_name" width={120} tick={{ fontSize: 12 }} stroke="oklch(0.50 0.03 255)" />
              <Tooltip
                contentStyle={{
                  borderRadius: 10,
                  border: "1px solid oklch(0.91 0.01 250)",
                  fontSize: 12,
                  boxShadow: "0 8px 24px -10px oklch(0.22 0.06 255 / 0.25)",
                }}
                cursor={{ fill: "oklch(0.96 0.01 250 / 0.6)" }}
              />
              <Bar dataKey="completed" stackId="a" fill="oklch(0.55 0.16 255)" name="Completed" radius={[0, 0, 0, 0]} />
              <Bar dataKey="pending" stackId="a" fill="oklch(0.82 0.14 75)" name="Pending" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel
          title="Week-on-week completion"
          subtitle="Rolling completion rate"
          icon={<TrendingUp className="size-4" />}
        >
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.trend} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="trendLine" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="oklch(0.55 0.16 255)" />
                  <stop offset="100%" stopColor="oklch(0.72 0.13 195)" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
              <XAxis dataKey="week" tickFormatter={(w) => w.slice(5)} tick={{ fontSize: 11 }} stroke="oklch(0.50 0.03 255)" />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} stroke="oklch(0.50 0.03 255)" />
              <Tooltip
                formatter={(v: number) => [`${v}%`, "Completion"]}
                contentStyle={{
                  borderRadius: 10,
                  border: "1px solid oklch(0.91 0.01 250)",
                  fontSize: 12,
                  boxShadow: "0 8px 24px -10px oklch(0.22 0.06 255 / 0.25)",
                }}
              />
              <Line
                type="monotone"
                dataKey="pct"
                stroke="url(#trendLine)"
                strokeWidth={3}
                dot={{ r: 4, fill: "oklch(0.55 0.16 255)", strokeWidth: 2, stroke: "white" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      </section>

      {/* Store breakdown */}
      <Panel
        title="Store-by-store breakdown"
        subtitle={`${filteredStores.length} store${filteredStores.length === 1 ? "" : "s"} in scope`}
        icon={<Activity className="size-4" />}
      >
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b">
                <th className="py-3 pr-4 font-medium">Store</th>
                <th className="py-3 pr-4 font-medium">Code</th>
                <th className="py-3 pr-4 font-medium">Region</th>
                <th className="py-3 pr-4 font-medium text-right">Due</th>
                <th className="py-3 pr-4 font-medium text-right">Done</th>
                <th className="py-3 pr-4 font-medium text-right">Flagged</th>
                <th className="py-3 pr-0 font-medium text-right w-44">Progress</th>
              </tr>
            </thead>
            <tbody>
              {filteredStores.map((s) => (
                <tr key={s.store_id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                  <td className="py-3 pr-4 font-medium">{s.store_name}</td>
                  <td className="py-3 pr-4 text-muted-foreground font-mono text-xs">{s.store_code}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{s.region}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{s.due}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{s.completed}</td>
                  <td className={`py-3 pr-4 text-right tabular-nums ${(s.flagged ?? 0) > 0 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                    {(s.flagged ?? 0) > 0 ? s.flagged : "—"}
                  </td>
                  <td className="py-3 pr-0">
                    <div className="flex items-center justify-end gap-3">
                      <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(s.pct, 100)}%`,
                            background: s.pct >= 80
                              ? "oklch(0.68 0.16 150)"
                              : s.pct >= 50
                              ? "oklch(0.55 0.16 255)"
                              : "oklch(0.78 0.16 75)",
                          }}
                        />
                      </div>
                      <span className="text-xs font-semibold tabular-nums w-9 text-right">{s.pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredStores.length === 0 && (
                <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">No stores in scope.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Stat({
  label, value, icon, tone = "neutral", progress,
}: {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "accent";
  progress?: number;
}) {
  const toneClass = {
    neutral: "text-foreground bg-muted text-muted-foreground",
    success: "text-[oklch(0.45_0.14_150)] bg-[oklch(0.68_0.16_150)]/15",
    warning: "text-[oklch(0.48_0.16_75)] bg-[oklch(0.78_0.16_75)]/20",
    accent: "text-[oklch(0.45_0.16_255)] bg-[oklch(0.55_0.16_255)]/12",
  }[tone];

  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className={`flex size-8 items-center justify-center rounded-lg ${toneClass}`}>{icon}</div>
      </div>
      <div className="mt-3 text-3xl font-bold tabular-nums tracking-tight">{value}</div>
      {typeof progress === "number" && (
        <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[oklch(0.55_0.16_255)] to-[oklch(0.72_0.13_195)] transition-all"
            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function Panel({
  title, subtitle, icon, children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          {icon && (
            <div className="flex size-8 items-center justify-center rounded-lg bg-[oklch(0.55_0.16_255)]/10 text-[oklch(0.45_0.16_255)]">
              {icon}
            </div>
          )}
          <div>
            <div className="text-sm font-semibold tracking-tight">{title}</div>
            {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
