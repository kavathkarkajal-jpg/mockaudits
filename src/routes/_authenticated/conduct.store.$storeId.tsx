import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listEmployeesByStore, getStore, getMyProfile,
  trainerUpsertEmployee, trainerDeleteEmployee,
} from "@/lib/api/mock-audit.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, Play, CheckCircle2, Clock, AlertTriangle,
  Plus, Pencil, Trash2, X, UserPlus, Store,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/conduct/store/$storeId")({
  component: StoreDetailPage,
});

const AVATAR_PALETTE = [
  ["oklch(0.92 0.04 255)", "oklch(0.35 0.12 255)"],
  ["oklch(0.92 0.06 150)", "oklch(0.30 0.10 150)"],
  ["oklch(0.92 0.05 300)", "oklch(0.35 0.12 300)"],
  ["oklch(0.93 0.05 60)", "oklch(0.40 0.12 60)"],
  ["oklch(0.92 0.05 20)", "oklch(0.40 0.14 20)"],
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

function StoreDetailPage() {
  const { storeId } = Route.useParams();
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["store-employees", storeId] });
    qc.invalidateQueries({ queryKey: ["stores-home"] });
  };

  const fetchEmployees = useServerFn(listEmployeesByStore);
  const fetchStore = useServerFn(getStore);
  const fetchMe = useServerFn(getMyProfile);
  const doUpsert = useServerFn(trainerUpsertEmployee);
  const doDelete = useServerFn(trainerDeleteEmployee);

  const { data: employees, isLoading } = useQuery({
    queryKey: ["store-employees", storeId],
    queryFn: () => fetchEmployees({ data: { store_id: storeId } }),
  });
  const { data: store } = useQuery({
    queryKey: ["store-detail", storeId],
    queryFn: () => fetchStore({ data: { store_id: storeId } }),
  });
  const { data: me } = useQuery({ queryKey: ["me-store-detail"], queryFn: () => fetchMe() });

  const canManageEmployees =
    me?.role === "admin" || me?.role === "trainer";

  // Employee form state
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [empName, setEmpName] = useState("");
  const [empCode, setEmpCode] = useState("");

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setEmpName("");
    setEmpCode("");
  };

  const startEdit = (e: { id: string; name: string; employee_code: string }) => {
    setEditId(e.id);
    setEmpName(e.name);
    setEmpCode(e.employee_code);
    setShowForm(true);
  };

  const upsertMut = useMutation({
    mutationFn: () =>
      doUpsert({
        data: {
          ...(editId ? { id: editId } : {}),
          store_id: storeId,
          name: empName.trim(),
          employee_code: empCode.trim(),
          active: true,
        },
      }),
    onSuccess: () => {
      toast.success(editId ? "Employee updated" : "Employee added");
      resetForm();
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => doDelete({ data: { id } }),
    onSuccess: () => { toast.success("Employee removed"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = employees?.length ?? 0;
  const completed = (employees ?? []).filter((e) => e.completedThisWeek).length;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="-mx-4 -my-6 sm:mx-0 sm:my-0 space-y-6">
      {/* Header */}
      <section className="bg-[oklch(0.18_0.05_255)] text-[oklch(0.985_0.003_240)] px-5 pt-5 pb-7 sm:rounded-2xl">
        <Link
          to="/conduct"
          className="inline-flex items-center gap-1.5 text-sm opacity-70 hover:opacity-100 mb-4 transition-opacity"
        >
          <ArrowLeft className="size-4" /> All stores
        </Link>

        <div className="flex items-start gap-3">
          <div
            className="size-12 rounded-xl inline-flex items-center justify-center shrink-0 mt-0.5"
            style={{
              background: `${store?.brand?.color ?? "#888"}33`,
              color: store?.brand?.color ?? "#888",
            }}
          >
            <Store className="size-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs opacity-70 uppercase tracking-wide">
              {store?.brand?.name ?? "—"} · {store?.region ?? "—"}
            </div>
            <h1 className="text-2xl font-bold tracking-tight mt-0.5 truncate">
              {store?.name ?? "Loading…"}
            </h1>
            <p className="text-sm opacity-70 mt-0.5">{store?.code}</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 flex items-center gap-4">
          <div className="flex-1">
            <div className="text-xs opacity-80 mb-1">This week's progress</div>
            <div className="h-2 rounded-full bg-white/20">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: pct >= 80 ? "oklch(0.72 0.18 150)" : pct >= 40 ? "oklch(0.78 0.18 85)" : "oklch(0.65 0.18 30)",
                }}
              />
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-bold">{pct}%</div>
            <div className="text-xs opacity-70">{completed}/{total} done</div>
          </div>
        </div>
      </section>

      {/* Trainer: Add employee form */}
      {canManageEmployees && (
        <div className="px-4 sm:px-0">
          {showForm ? (
            <div className="rounded-2xl border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-sm">{editId ? "Edit employee" : "Add employee"}</h3>
                <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Full name</Label>
                  <Input
                    value={empName}
                    onChange={(e) => setEmpName(e.target.value)}
                    placeholder="e.g. Priya Sharma"
                    className="h-10 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Employee code</Label>
                  <Input
                    value={empCode}
                    onChange={(e) => setEmpCode(e.target.value)}
                    placeholder="e.g. EMP001"
                    className="h-10 text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={!empName.trim() || !empCode.trim() || upsertMut.isPending}
                  onClick={() => upsertMut.mutate()}
                  className="flex-1"
                >
                  {upsertMut.isPending ? "Saving…" : editId ? "Update" : "Add employee"}
                </Button>
                <Button size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-xl h-10 gap-2 border-dashed"
              onClick={() => setShowForm(true)}
            >
              <UserPlus className="size-4" /> Add employee to this store
            </Button>
          )}
        </div>
      )}

      {/* Employee list */}
      <div className="px-4 sm:px-0 space-y-3">
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Loading employees…</div>
        ) : total === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No employees in this store yet.
            {canManageEmployees && " Use the button above to add one."}
          </div>
        ) : (
          (employees ?? []).map((e) => {
            const [bg, fg] = paletteFor(e.name) as [string, string];
            const done = e.completedThisWeek;
            const flagged = e.needsReaudit;
            return (
              <div
                key={e.id}
                className={`rounded-2xl border bg-card p-4 shadow-sm ${flagged ? "border-destructive/50" : ""}`}
              >
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
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {done ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium bg-[oklch(0.94_0.06_150)] text-[oklch(0.30_0.10_150)]">
                        <CheckCircle2 className="size-3" /> Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium bg-[oklch(0.94_0.06_75)] text-[oklch(0.40_0.12_75)]">
                        <Clock className="size-3" /> Pending
                      </span>
                    )}
                    {flagged && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="size-3" /> Re-audit
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  {flagged ? (
                    <Button asChild variant="destructive" className="flex-1 h-10 rounded-xl text-sm">
                      <Link to="/conduct/$employeeId" params={{ employeeId: e.id }}>
                        <AlertTriangle className="size-4 mr-1" /> Start Re-audit
                      </Link>
                    </Button>
                  ) : done ? (
                    <Button disabled variant="secondary" className="flex-1 h-10 rounded-xl text-sm">
                      Done this week
                    </Button>
                  ) : (
                    <Button asChild className="flex-1 h-10 rounded-xl text-sm bg-[oklch(0.18_0.05_255)] hover:bg-[oklch(0.22_0.06_255)] text-white">
                      <Link to="/conduct/$employeeId" params={{ employeeId: e.id }}>
                        <Play className="size-4 fill-[oklch(0.72_0.18_150)] text-[oklch(0.72_0.18_150)] mr-1" />
                        Start Role Play
                      </Link>
                    </Button>
                  )}

                  {canManageEmployees && (
                    <>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-10 w-10 rounded-xl shrink-0"
                        onClick={() => startEdit(e)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-10 w-10 rounded-xl shrink-0 border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => {
                          if (confirm(`Remove ${e.name}?`)) deleteMut.mutate(e.id);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
