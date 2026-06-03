import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listEmployees } from "@/lib/api/mock-audit.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Filter, Tag, Store as StoreIcon, ClipboardCheck,
  Clock, CheckCircle2, ChevronRight, Play, User,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/conduct/")({ component: ConductPage });

const AVATAR_PALETTE = [
  ["oklch(0.92 0.04 255)", "oklch(0.35 0.12 255)"],
  ["oklch(0.92 0.06 150)", "oklch(0.30 0.10 150)"],
  ["oklch(0.92 0.05 300)", "oklch(0.35 0.12 300)"],
  ["oklch(0.93 0.05 60)",  "oklch(0.40 0.12 60)"],
  ["oklch(0.92 0.05 20)",  "oklch(0.40 0.14 20)"],
  ["oklch(0.92 0.05 200)", "oklch(0.35 0.12 200)"],
];
function initialsOf(name: string) {
  const parts = name.replace(/^(Mr\.|Ms\.|Mrs\.|Dr\.)\s+/i, "").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}
function paletteFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function ConductPage() {
  const fetch = useServerFn(listEmployees);
  const { data, isLoading } = useQuery({ queryKey: ["employees"], queryFn: () => fetch() });
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState<string>("all");
  const [store, setStore] = useState<string>("all");

  const brands = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>();
    (data ?? []).forEach((e) => e.store?.brand && m.set(e.store.brand.id, { id: e.store.brand.id, name: e.store.brand.name }));
    return [...m.values()];
  }, [data]);
  const stores = useMemo(() => {
    const m = new Map<string, { id: string; name: string; brand_id?: string }>();
    (data ?? []).forEach((e) => e.store && m.set(e.store.id, { id: e.store.id, name: e.store.name, brand_id: e.store.brand?.id }));
    return [...m.values()].filter((s) => brand === "all" || s.brand_id === brand);
  }, [data, brand]);

  const filtered = (data ?? []).filter((e) =>
    (q ? (e.name.toLowerCase().includes(q.toLowerCase()) || e.employee_code.toLowerCase().includes(q.toLowerCase())) : true) &&
    (brand === "all" || e.store?.brand?.id === brand) &&
    (store === "all" || e.store?.id === store)
  );

  const total = data?.length ?? 0;
  const completed = (data ?? []).filter((e) => e.completedThisWeek).length;
  const pending = total - completed;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="-mx-4 -my-6 sm:mx-0 sm:my-0 space-y-6">
      {/* Hero */}
      <section className="bg-[oklch(0.18_0.05_255)] text-[oklch(0.985_0.003_240)] px-5 pt-6 pb-8 sm:rounded-2xl">
        <div className="text-sm opacity-80">Welcome back,</div>
        <h1 className="text-3xl font-bold tracking-tight mt-0.5">Mock Audit Manager</h1>
        <p className="text-sm opacity-80 mt-1">Conduct weekly mock audits for your team</p>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-full bg-[oklch(0.55_0.16_255)] inline-flex items-center justify-center shrink-0">
              <ClipboardCheck className="size-6 text-white"/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs opacity-80">This Week's Progress</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{pct}%</span>
                <span className="text-xs opacity-80">Completed</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full bg-white/15 rounded-full overflow-hidden">
                <div className="h-full bg-[oklch(0.72_0.18_150)] rounded-full" style={{ width: `${pct}%` }}/>
              </div>
            </div>
            <div className="hidden sm:block w-px h-12 bg-white/15"/>
            <div className="text-center px-2">
              <div className="text-xl font-bold leading-tight">{completed}<span className="opacity-60">/{total}</span></div>
              <div className="text-[10px] uppercase tracking-wide opacity-70">Completed</div>
            </div>
            <div className="text-center px-2">
              <div className="text-xl font-bold leading-tight">{pending}</div>
              <div className="text-[10px] uppercase tracking-wide opacity-70">Pending</div>
            </div>
          </div>
        </div>
      </section>

      <div className="px-4 sm:px-0 space-y-5">
        {/* Section title */}
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-full bg-[oklch(0.55_0.16_255)] inline-flex items-center justify-center shrink-0">
            <User className="size-5 text-white"/>
          </div>
          <div>
            <h2 className="text-xl font-bold leading-tight">Conduct Audit</h2>
            <p className="text-xs text-muted-foreground">Select an employee to start their weekly mock audit</p>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
              <Input
                placeholder="Search by employee name or code…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9 h-11 rounded-xl bg-card"
              />
            </div>
            <button type="button" aria-label="Filter" className="h-11 w-11 rounded-xl border bg-card inline-flex items-center justify-center text-muted-foreground hover:bg-accent/10">
              <Filter className="size-4"/>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={brand} onValueChange={(v) => { setBrand(v); setStore("all"); }}>
              <SelectTrigger className="h-11 rounded-xl bg-card">
                <Tag className="size-4 text-muted-foreground mr-1"/>
                <SelectValue placeholder="All brands"/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All brands</SelectItem>
                {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={store} onValueChange={setStore}>
              <SelectTrigger className="h-11 rounded-xl bg-card">
                <StoreIcon className="size-4 text-muted-foreground mr-1"/>
                <SelectValue placeholder="All stores"/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stores</SelectItem>
                {stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No employees in your scope yet. Ask an admin to add some.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((e) => {
              const [bg, fg] = paletteFor(e.name);
              const done = e.completedThisWeek;
              return (
                <div key={e.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div
                      className="size-14 rounded-full inline-flex items-center justify-center text-base font-bold shrink-0"
                      style={{ background: bg, color: fg }}
                    >
                      {initialsOf(e.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-bold leading-tight truncate">{e.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{e.employee_code}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {e.store?.brand?.name ?? "—"} · {e.store?.name ?? "—"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {done ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium bg-[oklch(0.94_0.06_150)] text-[oklch(0.30_0.10_150)]">
                          <CheckCircle2 className="size-3"/> Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium bg-[oklch(0.94_0.06_75)] text-[oklch(0.40_0.12_75)]">
                          <Clock className="size-3"/> Pending
                        </span>
                      )}
                      <ChevronRight className="size-4 text-muted-foreground"/>
                    </div>
                  </div>
                  <div className="mt-3">
                    {done ? (
                      <Button disabled variant="secondary" className="w-full h-11 rounded-xl">Done this week</Button>
                    ) : (
                      <Button asChild className="w-full h-11 rounded-xl bg-[oklch(0.18_0.05_255)] hover:bg-[oklch(0.22_0.06_255)] text-white">
                        <Link to="/conduct/$employeeId" params={{ employeeId: e.id }}>
                          <Play className="size-4 fill-[oklch(0.72_0.18_150)] text-[oklch(0.72_0.18_150)] mr-1"/>
                          Start Mock Audit
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
