import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getDashboard } from "@/lib/api/mock-audit.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Activity, AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, ClipboardList,
  Clock, Filter, ShieldAlert, TrendingUp,
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
  const filteredSections = useMemo(
    () => (brandFilter === "all" ? data?.sectionStats ?? [] : (data?.sectionStats ?? []).filter((s) => s.brand_id === brandFilter)),
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
        <section
          role="alert"
          className="relative overflow-hidden rounded-2xl border-2 border-destructive/50 bg-gradient-to-br from-destructive/15 via-destructive/8 to-background shadow-[0_8px_30px_-12px_oklch(0.55_0.22_25/0.35)]"
        >
          <div aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-destructive" />
          <div
            aria-hidden
            className="absolute -right-16 -top-16 size-56 rounded-full bg-destructive/15 blur-3xl"
          />
          <div className="relative flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between md:p-6">
            <div className="flex items-start gap-4">
              <div className="relative flex size-14 shrink-0 items-center justify-center rounded-xl bg-destructive text-destructive-foreground shadow-lg shadow-destructive/30">
                <ShieldAlert className="size-7" />
                <span aria-hidden className="absolute inset-0 rounded-xl ring-2 ring-destructive/40 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 rounded-full bg-destructive/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-destructive">
                  <AlertTriangle className="size-3" /> Action required
                </div>
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  <span className="text-destructive tabular-nums">{summary?.totalFlagged}</span>{" "}
                  employee{(summary?.totalFlagged ?? 0) === 1 ? "" : "s"} flagged for re-audit
                </h2>
                <p className="text-sm text-muted-foreground max-w-xl">
                  Scores fell below the brand threshold. Re-audit before week-end to keep store compliance on track.
                </p>
              </div>
            </div>
            <Button
              asChild
              size="lg"
              variant="destructive"
              className="shadow-md shadow-destructive/30 hover:shadow-lg hover:shadow-destructive/40 transition-shadow shrink-0 self-stretch md:self-auto"
            >
              <Link to="/conduct">
                Start re-audits
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>
      )}

      {/* Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Brand-wise completion */}
        <InsightCard
          className="lg:col-span-3"
          eyebrow="Brand performance"
          title="Brand-wise completion"
          subtitle="Audits completed vs. pending, ranked by volume this week"
          icon={<ClipboardList className="size-4" />}
          legend={[
            { label: "Completed", color: "oklch(0.55 0.16 255)" },
            { label: "Pending", color: "oklch(0.82 0.14 75)" },
          ]}
          headline={
            filteredBrands.length === 0
              ? "—"
              : `${Math.round(
                  (filteredBrands.reduce((a, b) => a + b.completed, 0) /
                    Math.max(filteredBrands.reduce((a, b) => a + b.due, 0), 1)) * 100,
                )}%`
          }
          headlineLabel="Avg. completion"
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={[...filteredBrands].sort((a, b) => b.due - a.due)}
              layout="vertical"
              margin={{ left: 8, right: 28, top: 4, bottom: 0 }}
              barCategoryGap={14}
            >
              <defs>
                <linearGradient id="brandBarCompleted" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="oklch(0.62 0.17 255)" />
                  <stop offset="100%" stopColor="oklch(0.55 0.16 255)" />
                </linearGradient>
                <linearGradient id="brandBarPending" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="oklch(0.86 0.13 75)" />
                  <stop offset="100%" stopColor="oklch(0.78 0.15 75)" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="oklch(0.92 0.01 250)" strokeDasharray="2 4" horizontal={false} />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "oklch(0.55 0.02 255)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="brand_name"
                width={120}
                tick={{ fontSize: 12, fill: "oklch(0.32 0.02 255)", fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip valueSuffix="" />} cursor={{ fill: "oklch(0.96 0.01 250 / 0.5)" }} />
              <Bar dataKey="completed" stackId="a" fill="url(#brandBarCompleted)" name="Completed" radius={[6, 0, 0, 6]} />
              <Bar dataKey="pending" stackId="a" fill="url(#brandBarPending)" name="Pending" radius={[0, 6, 6, 0]}>
                <LabelList
                  dataKey="due"
                  position="right"
                  formatter={(v: number) => `${v}`}
                  style={{ fontSize: 11, fill: "oklch(0.45 0.02 255)", fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </InsightCard>

        {/* Week-on-week trend */}
        <InsightCard
          className="lg:col-span-2"
          eyebrow="Trend"
          title="Week-on-week completion"
          subtitle="Rolling completion rate over recent weeks"
          icon={<TrendingUp className="size-4" />}
          headline={`${data.trend.at(-1)?.pct ?? 0}%`}
          headlineLabel="Latest week"
          headlineDelta={(() => {
            const last = data.trend.at(-1)?.pct ?? 0;
            const prev = data.trend.at(-2)?.pct ?? last;
            return last - prev;
          })()}
        >
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.trend} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="trendStroke" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="oklch(0.55 0.16 255)" />
                  <stop offset="100%" stopColor="oklch(0.72 0.13 195)" />
                </linearGradient>
                <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.62 0.16 230)" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="oklch(0.72 0.13 195)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="oklch(0.92 0.01 250)" strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="week"
                tickFormatter={(w) => w.slice(5)}
                tick={{ fontSize: 11, fill: "oklch(0.55 0.02 255)" }}
                axisLine={false}
                tickLine={false}
                dy={4}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11, fill: "oklch(0.55 0.02 255)" }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip content={<ChartTooltip valueSuffix="%" />} cursor={{ stroke: "oklch(0.55 0.16 255)", strokeWidth: 1, strokeDasharray: "3 3" }} />
              <Area
                type="monotone"
                dataKey="pct"
                stroke="url(#trendStroke)"
                strokeWidth={2.5}
                fill="url(#trendFill)"
                dot={{ r: 3, fill: "white", strokeWidth: 2, stroke: "oklch(0.55 0.16 255)" }}
                activeDot={{ r: 6, fill: "oklch(0.55 0.16 255)", strokeWidth: 3, stroke: "white" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </InsightCard>
      </section>


      {/* Store breakdown */}
      {(() => {
        const totalFlaggedStores = filteredStores.filter((s) => (s.flagged ?? 0) > 0).length;
        return (
          <Panel
            title="Store-by-store breakdown"
            subtitle={`${filteredStores.length} store${filteredStores.length === 1 ? "" : "s"} in scope${totalFlaggedStores ? ` · ${totalFlaggedStores} need attention` : ""}`}
            icon={<Activity className="size-4" />}
          >
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm border-separate border-spacing-0">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground/80">
                    <th className="py-3 pl-5 pr-4 font-semibold">Store</th>
                    <th className="py-3 pr-4 font-semibold">Region</th>
                    <th className="py-3 pr-4 font-semibold text-right">Due</th>
                    <th className="py-3 pr-4 font-semibold text-right">Done</th>
                    <th className="py-3 pr-4 font-semibold text-right">Flagged</th>
                    <th className="py-3 pr-5 font-semibold text-right w-[260px]">Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStores.map((s, idx) => {
                    const flagged = s.flagged ?? 0;
                    const isFlagged = flagged > 0;
                    const tone =
                      s.pct >= 80
                        ? { bar: "oklch(0.68 0.16 150)", chip: "bg-[oklch(0.68_0.16_150)]/15 text-[oklch(0.40_0.14_150)]", label: "On track" }
                        : s.pct >= 50
                        ? { bar: "oklch(0.55 0.16 255)", chip: "bg-[oklch(0.55_0.16_255)]/12 text-[oklch(0.42_0.16_255)]", label: "In progress" }
                        : { bar: "oklch(0.78 0.16 75)", chip: "bg-[oklch(0.78_0.16_75)]/20 text-[oklch(0.45_0.16_75)]", label: "At risk" };
                    return (
                      <tr
                        key={s.store_id}
                        className={`group transition-colors ${isFlagged ? "bg-destructive/[0.03] hover:bg-destructive/[0.06]" : idx % 2 === 1 ? "bg-muted/20 hover:bg-muted/40" : "hover:bg-muted/40"}`}
                      >
                        <td className={`py-3.5 pl-5 pr-4 border-t relative ${isFlagged ? "border-destructive/15" : "border-border/60"}`}>
                          {isFlagged && (
                            <span aria-hidden className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-0.5 rounded-r bg-destructive" />
                          )}
                          <div className="flex items-center gap-2.5">
                            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[oklch(0.55_0.16_255)]/10 to-[oklch(0.72_0.13_195)]/10 text-[10px] font-bold text-[oklch(0.42_0.16_255)] tracking-tight">
                              {s.store_name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-foreground leading-tight truncate">{s.store_name}</div>
                              <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{s.store_code}</div>
                            </div>
                          </div>
                        </td>
                        <td className={`py-3.5 pr-4 border-t text-muted-foreground ${isFlagged ? "border-destructive/15" : "border-border/60"}`}>
                          {s.region}
                        </td>
                        <td className={`py-3.5 pr-4 border-t text-right tabular-nums text-muted-foreground ${isFlagged ? "border-destructive/15" : "border-border/60"}`}>
                          {s.due}
                        </td>
                        <td className={`py-3.5 pr-4 border-t text-right tabular-nums font-medium text-foreground ${isFlagged ? "border-destructive/15" : "border-border/60"}`}>
                          {s.completed}
                        </td>
                        <td className={`py-3.5 pr-4 border-t text-right ${isFlagged ? "border-destructive/15" : "border-border/60"}`}>
                          {isFlagged ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-destructive/20">
                              <AlertTriangle className="size-3" />
                              {flagged}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 tabular-nums">—</span>
                          )}
                        </td>
                        <td className={`py-3.5 pr-5 border-t ${isFlagged ? "border-destructive/15" : "border-border/60"}`}>
                          <div className="flex items-center justify-end gap-3">
                            <span className={`hidden md:inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.chip}`}>
                              {tone.label}
                            </span>
                            <div className="relative h-2 w-28 rounded-full bg-muted overflow-hidden ring-1 ring-border/60">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(s.pct, 100)}%`,
                                  background: `linear-gradient(90deg, ${tone.bar}, ${tone.bar})`,
                                  boxShadow: `0 0 8px -2px ${tone.bar}`,
                                }}
                              />
                            </div>
                            <span className="text-sm font-bold tabular-nums w-11 text-right tracking-tight">{s.pct}<span className="text-[10px] font-semibold text-muted-foreground ml-0.5">%</span></span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredStores.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground border-t border-border/60">
                        No stores in scope.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        );
      })()}
    </div>
  );
}

function HeroKpi({ pct, completed, due }: { pct: number; completed: number; due: number }) {
  const status = pct >= 80 ? "On track" : pct >= 50 ? "In progress" : "Needs attention";
  const statusTone =
    pct >= 80
      ? "bg-[oklch(0.68_0.16_150)]/15 text-[oklch(0.42_0.14_150)]"
      : pct >= 50
      ? "bg-[oklch(0.55_0.16_255)]/12 text-[oklch(0.42_0.16_255)]"
      : "bg-[oklch(0.78_0.16_75)]/20 text-[oklch(0.45_0.16_75)]";

  const circumference = 2 * Math.PI * 42;
  const dash = (Math.min(Math.max(pct, 0), 100) / 100) * circumference;

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm">
      <div
        aria-hidden
        className="absolute -right-12 -top-12 size-44 rounded-full bg-gradient-to-br from-[oklch(0.55_0.16_255)]/10 to-[oklch(0.72_0.13_195)]/10 blur-2xl"
      />
      <div className="relative flex items-center gap-5">
        {/* Ring */}
        <div className="relative shrink-0">
          <svg width="104" height="104" viewBox="0 0 104 104" className="-rotate-90">
            <circle cx="52" cy="52" r="42" fill="none" stroke="oklch(0.92 0.01 250)" strokeWidth="10" />
            <circle
              cx="52" cy="52" r="42" fill="none"
              stroke="url(#kpiRing)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
              className="transition-[stroke-dasharray] duration-700"
            />
            <defs>
              <linearGradient id="kpiRing" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.55 0.16 255)" />
                <stop offset="100%" stopColor="oklch(0.72 0.13 195)" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-2xl font-bold tabular-nums tracking-tight leading-none">{pct}<span className="text-base text-muted-foreground">%</span></div>
          </div>
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Completion</span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTone}`}>
              {status}
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums tracking-tight">{completed}</span>
            <span className="text-base text-muted-foreground">/ {due}</span>
            <span className="text-xs text-muted-foreground">audits done</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {due === 0
              ? "No audits scheduled this week."
              : pct >= 100
              ? "Every audit complete. Excellent work."
              : `${due - completed} remaining to hit target.`}
          </p>
        </div>
      </div>
    </div>
  );
}

function MiniKpi({
  label, value, icon, tone, caption,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone: "neutral" | "success" | "warning";
  caption?: string;
}) {
  const cfg = {
    neutral: { iconBg: "bg-muted text-muted-foreground", accent: "bg-border" },
    success: { iconBg: "bg-[oklch(0.68_0.16_150)]/15 text-[oklch(0.42_0.14_150)]", accent: "bg-[oklch(0.68_0.16_150)]" },
    warning: { iconBg: "bg-[oklch(0.78_0.16_75)]/20 text-[oklch(0.48_0.16_75)]", accent: "bg-[oklch(0.78_0.16_75)]" },
  }[tone];

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
      <span aria-hidden className={`absolute inset-y-0 left-0 w-0.5 ${cfg.accent}`} />
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={`flex size-7 items-center justify-center rounded-md ${cfg.iconBg}`}>{icon}</span>
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{value}</div>
      {caption && <div className="mt-1 text-[11px] text-muted-foreground">{caption}</div>}
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

function InsightCard({
  eyebrow, title, subtitle, icon, headline, headlineLabel, headlineDelta,
  legend, className, children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  headline?: string;
  headlineLabel?: string;
  headlineDelta?: number;
  legend?: { label: string; color: string }[];
  className?: string;
  children: React.ReactNode;
}) {
  const deltaTone =
    headlineDelta === undefined || headlineDelta === 0
      ? "text-muted-foreground bg-muted"
      : headlineDelta > 0
      ? "text-[oklch(0.42_0.14_150)] bg-[oklch(0.68_0.16_150)]/15"
      : "text-destructive bg-destructive/10";
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border bg-card shadow-sm hover:shadow-md transition-shadow ${className ?? ""}`}
    >
      <div
        aria-hidden
        className="absolute -right-16 -top-16 size-48 rounded-full bg-gradient-to-br from-[oklch(0.55_0.16_255)]/8 to-[oklch(0.72_0.13_195)]/8 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4 p-5 pb-3">
        <div className="flex items-start gap-3 min-w-0">
          {icon && (
            <div className="flex size-9 items-center justify-center rounded-lg bg-[oklch(0.55_0.16_255)]/10 text-[oklch(0.45_0.16_255)] ring-1 ring-[oklch(0.55_0.16_255)]/15">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                {eyebrow}
              </div>
            )}
            <h3 className="text-base font-semibold tracking-tight text-foreground leading-tight mt-0.5">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1 max-w-md">{subtitle}</p>
            )}
          </div>
        </div>
        {headline !== undefined && (
          <div className="text-right shrink-0">
            <div className="flex items-baseline justify-end gap-2">
              <span className="text-2xl font-bold tabular-nums tracking-tight">{headline}</span>
              {headlineDelta !== undefined && (
                <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${deltaTone}`}>
                  {headlineDelta > 0 ? "▲" : headlineDelta < 0 ? "▼" : "•"}
                  {Math.abs(headlineDelta)}pt
                </span>
              )}
            </div>
            {headlineLabel && (
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                {headlineLabel}
              </div>
            )}
          </div>
        )}
      </div>
      {legend && legend.length > 0 && (
        <div className="relative flex flex-wrap items-center gap-3 px-5 pb-2">
          {legend.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="size-2 rounded-sm" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      )}
      <div className="relative px-2 pb-4 pt-1">{children}</div>
    </div>
  );
}

function ChartTooltip({
  active, payload, label, valueSuffix = "",
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string; dataKey?: string }>;
  label?: string | number;
  valueSuffix?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border/70 bg-popover/95 backdrop-blur px-3 py-2 shadow-lg text-xs min-w-[140px]">
      {label !== undefined && (
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
          {String(label)}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-foreground">
              <span className="size-2 rounded-sm" style={{ background: p.color }} />
              {p.name ?? p.dataKey}
            </span>
            <span className="font-semibold tabular-nums">{p.value}{valueSuffix}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
