import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  adminListAll, upsertBrand, deleteBrand, upsertStore, deleteStore,
  upsertEmployee, deleteEmployee, createUser, deleteUser, getMyProfile,
  adminListQuestions, upsertQuestion, deleteQuestion, reorderQuestions,
} from "@/lib/api/mock-audit.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const me = await getMyProfile();
    if (me.role !== "admin") throw redirect({ to: "/conduct" });
  },
  component: AdminPage,
});

function AdminPage() {
  const fetchAll = useServerFn(adminListAll);
  const { data } = useQuery({ queryKey: ["admin-all"], queryFn: () => fetchAll() });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <Tabs defaultValue="brands">
        <TabsList>
          <TabsTrigger value="brands">Brands</TabsTrigger>
          <TabsTrigger value="stores">Stores</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
        </TabsList>
        <TabsContent value="brands"><BrandsTab brands={data?.brands ?? []}/></TabsContent>
        <TabsContent value="stores"><StoresTab brands={data?.brands ?? []} stores={data?.stores ?? []}/></TabsContent>
        <TabsContent value="employees"><EmployeesTab stores={data?.stores ?? []} employees={data?.employees ?? []}/></TabsContent>
        <TabsContent value="users"><UsersTab brands={data?.brands ?? []} stores={data?.stores ?? []} profiles={data?.profiles ?? []} roles={data?.roles ?? []}/></TabsContent>
        <TabsContent value="questions"><QuestionsTab brands={data?.brands ?? []}/></TabsContent>
      </Tabs>
    </div>
  );
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => { qc.invalidateQueries({ queryKey: ["admin-all"] }); qc.invalidateQueries({ queryKey: ["employees"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); };
}

function BrandsTab({ brands }: { brands: Array<{ id: string; name: string; primary_color: string }> }) {
  const inv = useInvalidate();
  const save = useServerFn(upsertBrand);
  const del = useServerFn(deleteBrand);
  const [name, setName] = useState(""); const [color, setColor] = useState("#0EA5E9");
  const m = useMutation({ mutationFn: () => save({ data: { name, primary_color: color } }), onSuccess: () => { toast.success("Brand saved"); setName(""); inv(); }, onError: (e: Error) => toast.error(e.message) });
  const d = useMutation({ mutationFn: (id: string) => del({ data: { id } }), onSuccess: () => { toast.success("Brand deleted"); inv(); }, onError: (e: Error) => toast.error(e.message) });
  return (
    <div className="space-y-4 mt-4">
      <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="flex flex-wrap gap-2 items-end rounded-xl border bg-card p-4">
        <div><Label>Brand name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required/></div>
        <div><Label>Accent color</Label><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-16 p-1 h-9"/></div>
        <Button type="submit" disabled={m.isPending}>Add brand</Button>
      </form>
      <RowsTable rows={brands} columns={[{ k: "name", h: "Name" }, { k: "primary_color", h: "Color" }]} onDelete={(r) => d.mutate(r.id)} />
    </div>
  );
}

function StoresTab({ brands, stores }: { brands: any[]; stores: any[] }) {
  const inv = useInvalidate();
  const save = useServerFn(upsertStore); const del = useServerFn(deleteStore);
  const [brand_id, setBrand] = useState(""); const [code, setCode] = useState(""); const [n, setN] = useState(""); const [region, setRegion] = useState("Default");
  const m = useMutation({ mutationFn: () => save({ data: { brand_id, store_code: code, store_name: n, region } }), onSuccess: () => { toast.success("Store saved"); setCode(""); setN(""); inv(); }, onError: (e: Error) => toast.error(e.message) });
  const d = useMutation({ mutationFn: (id: string) => del({ data: { id } }), onSuccess: () => { toast.success("Deleted"); inv(); }, onError: (e: Error) => toast.error(e.message) });
  return (
    <div className="space-y-4 mt-4">
      <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="flex flex-wrap gap-2 items-end rounded-xl border bg-card p-4">
        <div className="min-w-40"><Label>Brand</Label>
          <Select value={brand_id} onValueChange={setBrand}><SelectTrigger><SelectValue placeholder="Select brand"/></SelectTrigger>
            <SelectContent>{brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Store code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} required/></div>
        <div><Label>Store name</Label><Input value={n} onChange={(e) => setN(e.target.value)} required/></div>
        <div><Label>Region</Label><Input value={region} onChange={(e) => setRegion(e.target.value)} required/></div>
        <Button type="submit" disabled={!brand_id || m.isPending}>Add store</Button>
      </form>
      <RowsTable rows={stores.map((s) => ({ ...s, brand: brands.find((b) => b.id === s.brand_id)?.name }))}
        columns={[{ k: "brand", h: "Brand" }, { k: "store_code", h: "Code" }, { k: "store_name", h: "Name" }, { k: "region", h: "Region" }]}
        onDelete={(r) => d.mutate(r.id)} />
    </div>
  );
}

function EmployeesTab({ stores, employees }: { stores: any[]; employees: any[] }) {
  const inv = useInvalidate();
  const save = useServerFn(upsertEmployee); const del = useServerFn(deleteEmployee);
  const [store_id, setStore] = useState(""); const [n, setN] = useState(""); const [code, setCode] = useState("");
  const m = useMutation({ mutationFn: () => save({ data: { store_id, name: n, employee_code: code, active: true } }), onSuccess: () => { toast.success("Employee saved"); setN(""); setCode(""); inv(); }, onError: (e: Error) => toast.error(e.message) });
  const d = useMutation({ mutationFn: (id: string) => del({ data: { id } }), onSuccess: () => { toast.success("Deactivated"); inv(); }, onError: (e: Error) => toast.error(e.message) });
  return (
    <div className="space-y-4 mt-4">
      <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="flex flex-wrap gap-2 items-end rounded-xl border bg-card p-4">
        <div className="min-w-48"><Label>Store</Label>
          <Select value={store_id} onValueChange={setStore}><SelectTrigger><SelectValue placeholder="Select store"/></SelectTrigger>
            <SelectContent>{stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.store_name} ({s.store_code})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Name</Label><Input value={n} onChange={(e) => setN(e.target.value)} required/></div>
        <div><Label>Employee code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} required/></div>
        <Button type="submit" disabled={!store_id || m.isPending}>Add employee</Button>
      </form>
      <RowsTable rows={employees.map((e) => ({ ...e, store: stores.find((s) => s.id === e.store_id)?.store_name }))}
        columns={[{ k: "name", h: "Name" }, { k: "employee_code", h: "Code" }, { k: "store", h: "Store" }, { k: "active", h: "Active" }]}
        onDelete={(r) => d.mutate(r.id)} />
    </div>
  );
}

function UsersTab({ brands, stores, profiles, roles }: { brands: any[]; stores: any[]; profiles: any[]; roles: any[] }) {
  const inv = useInvalidate();
  const create = useServerFn(createUser); const del = useServerFn(deleteUser);
  const [storeCode, setStoreCode] = useState(""); const [password, setPassword] = useState(""); const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<string>("store_manager");
  const [brand_id, setBrand] = useState<string>(""); const [store_id, setStoreId] = useState<string>(""); const [region, setRegion] = useState("");

  const m = useMutation({
    mutationFn: () => create({ data: {
      store_code: storeCode, password, full_name: fullName, role: role as any,
      brand_id: brand_id || null, store_id: store_id || null, region: region || null,
    } }),
    onSuccess: () => { toast.success("User created"); setStoreCode(""); setPassword(""); setFullName(""); inv(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const d = useMutation({ mutationFn: (id: string) => del({ data: { id } }), onSuccess: () => { toast.success("Deleted"); inv(); }, onError: (e: Error) => toast.error(e.message) });

  const roleByUser = new Map(roles.map((r) => [r.user_id, r.role]));
  return (
    <div className="space-y-4 mt-4">
      <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-xl border bg-card p-4">
        <div><Label>Store code (login)</Label><Input value={storeCode} onChange={(e) => setStoreCode(e.target.value)} required/></div>
        <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}/></div>
        <div><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} required/></div>
        <div><Label>Role</Label>
          <Select value={role} onValueChange={setRole}><SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>
              {["store_manager","regional_manager","trainer","business_head","admin"].map((r) =>
                <SelectItem key={r} value={r}>{r.replace("_"," ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Brand (optional)</Label>
          <Select value={brand_id} onValueChange={setBrand}><SelectTrigger><SelectValue placeholder="None"/></SelectTrigger>
            <SelectContent>{brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Store (for store managers)</Label>
          <Select value={store_id} onValueChange={setStoreId}><SelectTrigger><SelectValue placeholder="None"/></SelectTrigger>
            <SelectContent>{stores.filter((s) => !brand_id || s.brand_id === brand_id).map((s) => <SelectItem key={s.id} value={s.id}>{s.store_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Region (for regional managers)</Label><Input value={region} onChange={(e) => setRegion(e.target.value)}/></div>
        <div className="md:col-span-2"><Button type="submit" disabled={m.isPending}>Create user</Button></div>
      </form>

      <RowsTable rows={profiles.map((p) => ({ ...p, role: roleByUser.get(p.id) }))}
        columns={[{ k: "store_code", h: "Store code" }, { k: "full_name", h: "Name" }, { k: "role", h: "Role" }, { k: "brand_id", h: "Brand" }]}
        onDelete={(r) => d.mutate(r.id)} />
    </div>
  );
}

function RowsTable({ rows, columns, onDelete }: { rows: any[]; columns: { k: string; h: string }[]; onDelete?: (r: any) => void }) {
  return (
    <div className="rounded-xl border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-muted-foreground border-b">
          <tr>{columns.map((c) => <th key={c.k} className="py-2 px-3">{c.h}</th>)}{onDelete && <th/>}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b last:border-0">
              {columns.map((c) => <td key={c.k} className="py-2 px-3">{String(r[c.k] ?? "—")}</td>)}
              {onDelete && <td className="px-3 text-right">
                <Button size="sm" variant="ghost" onClick={() => onDelete(r)}><Trash2 className="size-4"/></Button>
              </td>}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={columns.length + 1} className="py-6 text-center text-muted-foreground">No records yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function QuestionsTab({ brands }: { brands: Array<{ id: string; name: string }> }) {
  const qc = useQueryClient();
  const fetchAll = useServerFn(adminListQuestions);
  const save = useServerFn(upsertQuestion);
  const del = useServerFn(deleteQuestion);
  const reorder = useServerFn(reorderQuestions);

  const [brandId, setBrandId] = useState<string>("");
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: all } = useQuery({
    queryKey: ["admin-questions"],
    queryFn: () => fetchAll(),
  });

  const list = (all ?? [])
    .filter((q) => q.brand_id === brandId)
    .sort((a, b) => a.display_order - b.display_order);

  const inv = () => qc.invalidateQueries({ queryKey: ["admin-questions"] });
  const invBrand = () => {
    inv();
    qc.invalidateQueries({ queryKey: ["questions", brandId] });
  };

  const m = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: editingId ?? undefined,
          brand_id: brandId,
          question_text: text,
          question_type: "yes_no",
        },
      }),
    onSuccess: () => {
      toast.success(editingId ? "Question updated" : "Question added");
      setText("");
      setEditingId(null);
      invBrand();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const d = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Question deleted"); invBrand(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveMut = useMutation({
    mutationFn: (ordered_ids: string[]) =>
      reorder({ data: { brand_id: brandId, ordered_ids } }),
    onSuccess: () => invBrand(),
    onError: (e: Error) => toast.error(e.message),
  });

  const move = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= list.length) return;
    const ids = list.map((q) => q.id);
    [ids[idx], ids[newIdx]] = [ids[newIdx], ids[idx]];
    moveMut.mutate(ids);
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="rounded-xl border bg-card p-4">
        <Label>Brand</Label>
        <Select value={brandId} onValueChange={(v) => { setBrandId(v); setEditingId(null); setText(""); }}>
          <SelectTrigger className="max-w-xs"><SelectValue placeholder="Select a brand"/></SelectTrigger>
          <SelectContent>
            {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {brandId && (
        <>
          <form
            onSubmit={(e) => { e.preventDefault(); if (text.trim()) m.mutate(); }}
            className="rounded-xl border bg-card p-4 space-y-3"
          >
            <Label htmlFor="qtext">{editingId ? "Edit question" : "New question"}</Label>
            <Textarea id="qtext" value={text} onChange={(e) => setText(e.target.value)} rows={2} required maxLength={1000}/>
            <div className="flex gap-2">
              <Button type="submit" disabled={m.isPending || !text.trim()}>
                {editingId ? "Save changes" : "Add question"}
              </Button>
              {editingId && (
                <Button type="button" variant="ghost" onClick={() => { setEditingId(null); setText(""); }}>
                  Cancel
                </Button>
              )}
            </div>
          </form>

          <div className="rounded-xl border bg-card overflow-hidden">
            {list.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No questions for this brand yet.
              </div>
            ) : (
              <ol className="divide-y">
                {list.map((q, idx) => (
                  <li key={q.id} className="flex items-start gap-3 p-3">
                    <div className="text-xs text-muted-foreground w-6 pt-2">{idx + 1}.</div>
                    <div className="flex-1 text-sm pt-1.5">{q.question_text}</div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" disabled={idx === 0 || moveMut.isPending} onClick={() => move(idx, -1)}>
                        <ArrowUp className="size-4"/>
                      </Button>
                      <Button size="icon" variant="ghost" disabled={idx === list.length - 1 || moveMut.isPending} onClick={() => move(idx, 1)}>
                        <ArrowDown className="size-4"/>
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { setEditingId(q.id); setText(q.question_text); }}>
                        <Pencil className="size-4"/>
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this question?")) d.mutate(q.id); }}>
                        <Trash2 className="size-4"/>
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
    </div>
  );
}
