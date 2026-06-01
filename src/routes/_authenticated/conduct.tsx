import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listEmployees } from "@/lib/api/mock-audit.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/conduct")({ component: ConductPage });

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Conduct Audit</h1>
        <p className="text-sm text-muted-foreground">Pick an employee and start their weekly mock audit.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search employee or code…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs"/>
        <Select value={brand} onValueChange={(v) => { setBrand(v); setStore("all"); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All brands"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All brands</SelectItem>
            {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={store} onValueChange={setStore}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All stores"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stores</SelectItem>
            {stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No employees in your scope yet. Ask an admin to add some.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((e) => (
            <div key={e.id} className="rounded-xl border bg-card p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-lg font-semibold leading-tight">{e.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {e.employee_code} · {e.store?.brand?.name ?? "—"} · {e.store?.name ?? "—"}
                  </div>
                </div>
                {e.completedThisWeek
                  ? <Badge className="bg-[oklch(0.68_0.16_150)] text-[oklch(0.15_0.05_150)] hover:bg-[oklch(0.68_0.16_150)]">Completed</Badge>
                  : <Badge className="bg-[oklch(0.78_0.16_75)] text-[oklch(0.20_0.06_75)] hover:bg-[oklch(0.78_0.16_75)]">Pending</Badge>}
              </div>
              <Button asChild disabled={e.completedThisWeek} variant={e.completedThisWeek ? "secondary" : "default"}>
                <Link to="/conduct/$employeeId" params={{ employeeId: e.id }}>
                  {e.completedThisWeek ? "Done this week" : "Start Mock Audit"}
                </Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
