import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listStores, getMyProfile } from "@/lib/api/mock-audit.functions";
import { Store, ChevronRight, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/conduct/")({ component: StoreHomePage });

function progressColor(pct: number) {
  if (pct >= 80) return "oklch(0.72 0.18 150)";
  if (pct >= 40) return "oklch(0.78 0.18 85)";
  return "oklch(0.65 0.18 30)";
}

function StoreHomePage() {
  const fetchStores = useServerFn(listStores);
  const fetchMe = useServerFn(getMyProfile);
  const { data: stores, isLoading } = useQuery({ queryKey: ["stores-home"], queryFn: () => fetchStores() });
  const { data: me } = useQuery({ queryKey: ["me-home"], queryFn: () => fetchMe() });

  const grouped = (stores ?? []).reduce<Record<string, typeof stores>>((acc, s) => {
    const key = s.brand?.name ?? "Other";
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(s);
    return acc;
  }, {});

  const totalStores = stores?.length ?? 0;
  const totalEmployees = (stores ?? []).reduce((a, s) => a + s.completion.total, 0);
  const totalCompleted = (stores ?? []).reduce((a, s) => a + s.completion.completed, 0);
  const overallPct = totalEmployees ? Math.round((totalCompleted / totalEmployees) * 100) : 0;

  return (
    <div className="-mx-4 -my-6 sm:mx-0 sm:my-0 space-y-6">
      {/* Hero */}
      <section className="bg-[oklch(0.18_0.05_255)] text-[oklch(0.985_0.003_240)] px-5 pt-6 pb-8 sm:rounded-2xl">
        <div className="text-sm opacity-80">Welcome back{me?.profile?.full_name ? `, ${me.profile.full_name}` : ""},</div>
        <h1 className="text-3xl font-bold tracking-tight mt-0.5">Mock Audit Manager</h1>
        <p className="text-sm opacity-80 mt-1 capitalize">
          {me?.role?.replace(/_/g, " ")} · Select a store to begin
        </p>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-full bg-[oklch(0.55_0.16_255)] inline-flex items-center justify-center shrink-0">
              <CheckCircle2 className="size-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs opacity-80">This Week — Overall</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{overallPct}%</span>
                <span className="text-sm opacity-70">{totalCompleted} / {totalEmployees} across {totalStores} stores</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/20">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${overallPct}%`, background: progressColor(overallPct) }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Store grid */}
      <div className="px-4 sm:px-0">
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading stores…</div>
        ) : totalStores === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No stores in your scope yet. Ask an admin to set you up.
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([brandName, brandStores]) => (
              <div key={brandName}>
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="size-3 rounded-full"
                    style={{ background: brandStores![0]?.brand?.color ?? "#888" }}
                  />
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">{brandName}</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {brandStores!.map((store) => {
                    const pct = store.completion.total
                      ? Math.round((store.completion.completed / store.completion.total) * 100)
                      : 0;
                    return (
                      <Link
                        key={store.id}
                        to="/conduct/store/$storeId"
                        params={{ storeId: store.id }}
                        className="group flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
                      >
                        <div
                          className="size-12 rounded-xl inline-flex items-center justify-center shrink-0"
                          style={{ background: `${store.brand?.color ?? "#888"}22`, color: store.brand?.color ?? "#888" }}
                        >
                          <Store className="size-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm leading-tight truncate">{store.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{store.code} · {store.region}</div>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-muted">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${pct}%`, background: progressColor(pct) }}
                              />
                            </div>
                            <span className="text-[11px] text-muted-foreground shrink-0">
                              {store.completion.completed}/{store.completion.total}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
