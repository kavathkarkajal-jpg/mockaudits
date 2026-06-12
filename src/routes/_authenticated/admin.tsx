import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  adminListAll, upsertBrand, deleteBrand, upsertStore, deleteStore,
  upsertEmployee, deleteEmployee, createUser, updateUserProfile, deleteUser, getMyProfile,
  previewImport, commitImport,
} from "@/lib/api/mock-audit.functions";
import { QuestionsTab } from "@/components/admin/QuestionsTab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Download, Pencil, Search, Trash2, Upload, X } from "lucide-react";


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
          <TabsTrigger value="import">Import</TabsTrigger>
        </TabsList>
        <TabsContent value="brands"><BrandsTab brands={data?.brands ?? []}/></TabsContent>
        <TabsContent value="stores"><StoresTab brands={data?.brands ?? []} stores={data?.stores ?? []}/></TabsContent>
        <TabsContent value="employees"><EmployeesTab stores={data?.stores ?? []} employees={data?.employees ?? []}/></TabsContent>
        <TabsContent value="users"><UsersTab brands={data?.brands ?? []} stores={data?.stores ?? []} profiles={data?.profiles ?? []} roles={data?.roles ?? []}/></TabsContent>
        <TabsContent value="questions"><QuestionsTab brands={data?.brands ?? []}/></TabsContent>
        <TabsContent value="import"><ImportTab/></TabsContent>
      </Tabs>

    </div>
  );
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => { qc.invalidateQueries({ queryKey: ["admin-all"] }); qc.invalidateQueries({ queryKey: ["employees"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); };
}

function BrandsTab({ brands }: { brands: Array<{ id: string; name: string; primary_color: string; reaudit_threshold: number | null }> }) {
  const inv = useInvalidate();
  const save = useServerFn(upsertBrand);
  const del = useServerFn(deleteBrand);
  const [name, setName] = useState(""); const [color, setColor] = useState("#0EA5E9");
  const [threshold, setThreshold] = useState<string>("");
  const m = useMutation({
    mutationFn: () => save({ data: {
      name,
      primary_color: color,
      reaudit_threshold: threshold.trim() === "" ? null : Number(threshold),
    } }),
    onSuccess: () => { toast.success("Brand saved"); setName(""); setThreshold(""); inv(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const d = useMutation({ mutationFn: (id: string) => del({ data: { id } }), onSuccess: () => { toast.success("Brand deleted"); inv(); }, onError: (e: Error) => toast.error(e.message) });
  return (
    <div className="space-y-4 mt-4">
      <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="flex flex-wrap gap-2 items-end rounded-xl border bg-card p-4">
        <div><Label>Brand name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required/></div>
        <div><Label>Accent color</Label><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-16 p-1 h-9"/></div>
        <div>
          <Label>Re-audit threshold (%)</Label>
          <Input
            type="number" min={0} max={100} step={1}
            placeholder="e.g. 60 — leave blank to disable"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-64"
          />
        </div>
        <Button type="submit" disabled={m.isPending}>Add brand</Button>
      </form>
      <RowsTable
        rows={brands.map((b) => ({ ...b, reaudit_label: b.reaudit_threshold == null ? "—" : `${b.reaudit_threshold}%` }))}
        columns={[{ k: "name", h: "Name" }, { k: "primary_color", h: "Color" }, { k: "reaudit_label", h: "Re-audit below" }]}
        onDelete={(r) => d.mutate(r.id)}
      />
    </div>
  );
}


function StoresTab({ brands, stores }: { brands: any[]; stores: any[] }) {
  const inv = useInvalidate();
  const save = useServerFn(upsertStore); const del = useServerFn(deleteStore);
  const [brand_id, setBrand] = useState(""); const [code, setCode] = useState(""); const [n, setN] = useState(""); const [region, setRegion] = useState("Default");
  const [search, setSearch] = useState("");
  const [filterBrand, setFilterBrand] = useState<string>("all");
  const m = useMutation({ mutationFn: () => save({ data: { brand_id, store_code: code, store_name: n, region } }), onSuccess: () => { toast.success("Store saved"); setCode(""); setN(""); inv(); }, onError: (e: Error) => toast.error(e.message) });
  const d = useMutation({ mutationFn: (id: string) => del({ data: { id } }), onSuccess: () => { toast.success("Deleted"); inv(); }, onError: (e: Error) => toast.error(e.message) });

  const q = search.trim().toLowerCase();
  const filtered = stores.filter((s) => {
    if (filterBrand !== "all" && s.brand_id !== filterBrand) return false;
    if (q && !(`${s.store_name ?? ""} ${s.store_code ?? ""}`.toLowerCase().includes(q))) return false;
    return true;
  });
  const hasFilters = q !== "" || filterBrand !== "all";

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

      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"/>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by store name or code" className="pl-8"/>
        </div>
        <Select value={filterBrand} onValueChange={setFilterBrand}>
          <SelectTrigger className="w-48"><SelectValue/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All brands</SelectItem>
            {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground tabular-nums">{filtered.length} of {stores.length} stores</div>
        {hasFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={() => { setSearch(""); setFilterBrand("all"); }}>
            <X className="size-4"/> Clear
          </Button>
        )}
      </div>

      <RowsTable rows={filtered.map((s) => ({ ...s, brand: brands.find((b) => b.id === s.brand_id)?.name }))}
        columns={[{ k: "brand", h: "Brand" }, { k: "store_code", h: "Code" }, { k: "store_name", h: "Name" }, { k: "region", h: "Region" }]}
        onDelete={(r) => d.mutate(r.id)} />
    </div>
  );
}

function EmployeesTab({ stores, employees }: { stores: any[]; employees: any[] }) {
  const inv = useInvalidate();
  const save = useServerFn(upsertEmployee); const del = useServerFn(deleteEmployee);
  const [store_id, setStore] = useState(""); const [n, setN] = useState(""); const [code, setCode] = useState("");
  const [search, setSearch] = useState("");
  const [filterStore, setFilterStore] = useState<string>("all");
  const [activeOnly, setActiveOnly] = useState(true);
  const m = useMutation({ mutationFn: () => save({ data: { store_id, name: n, employee_code: code, active: true } }), onSuccess: () => { toast.success("Employee saved"); setN(""); setCode(""); inv(); }, onError: (e: Error) => toast.error(e.message) });
  const d = useMutation({ mutationFn: (id: string) => del({ data: { id } }), onSuccess: () => { toast.success("Deactivated"); inv(); }, onError: (e: Error) => toast.error(e.message) });

  const q = search.trim().toLowerCase();
  const filtered = employees.filter((e) => {
    if (activeOnly && !e.active) return false;
    if (filterStore !== "all" && e.store_id !== filterStore) return false;
    if (q && !(`${e.name ?? ""} ${e.employee_code ?? ""}`.toLowerCase().includes(q))) return false;
    return true;
  });
  const hasFilters = q !== "" || filterStore !== "all" || !activeOnly;

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

      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"/>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or employee code" className="pl-8"/>
        </div>
        <Select value={filterStore} onValueChange={setFilterStore}>
          <SelectTrigger className="w-56"><SelectValue/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stores</SelectItem>
            {stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.store_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none px-2">
          <Checkbox checked={activeOnly} onCheckedChange={(v) => setActiveOnly(v === true)}/>
          Active only
        </label>
        <div className="text-xs text-muted-foreground tabular-nums">{filtered.length} of {employees.length} employees</div>
        {hasFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={() => { setSearch(""); setFilterStore("all"); setActiveOnly(true); }}>
            <X className="size-4"/> Clear
          </Button>
        )}
      </div>

      <RowsTable rows={filtered.map((e) => ({ ...e, store: stores.find((s) => s.id === e.store_id)?.store_name }))}
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

function RowsTable({ rows, columns, onDelete, onEdit }: { rows: any[]; columns: { k: string; h: string }[]; onDelete?: (r: any) => void; onEdit?: (r: any) => void }) {
  const hasActions = Boolean(onDelete || onEdit);
  return (
    <div className="rounded-xl border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-muted-foreground border-b">
          <tr>{columns.map((c) => <th key={c.k} className="py-2 px-3">{c.h}</th>)}{hasActions && <th/>}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b last:border-0">
              {columns.map((c) => <td key={c.k} className="py-2 px-3">{String(r[c.k] ?? "—")}</td>)}
              {hasActions && <td className="px-3 text-right whitespace-nowrap">
                {onEdit && <Button size="sm" variant="ghost" onClick={() => onEdit(r)} aria-label="Edit"><Pencil className="size-4"/></Button>}
                {onDelete && <Button size="sm" variant="ghost" onClick={() => onDelete(r)} aria-label="Delete"><Trash2 className="size-4"/></Button>}
              </td>}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={columns.length + (hasActions ? 1 : 0)} className="py-6 text-center text-muted-foreground">No records yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Import tab ----------
const HEADERS = [
  "Brand Name", "Store Code", "Store Name", "Region",
  "Employee Name", "Employee Code", "Store Password",
] as const;

type ParsedRow = {
  brand_name: string; store_code: string; store_name: string; region: string;
  employee_name: string; employee_code: string; store_password: string;
};

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => {
    const s = String(c ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function normalizeHeaderRow(rawRows: Record<string, unknown>[]): ParsedRow[] {
  const keyMap: Record<string, keyof ParsedRow> = {
    "brand name": "brand_name",
    "store code": "store_code",
    "store name": "store_name",
    "region": "region",
    "employee name": "employee_name",
    "employee code": "employee_code",
    "store password": "store_password",
  };
  return rawRows.map((row) => {
    const out: ParsedRow = {
      brand_name: "", store_code: "", store_name: "", region: "",
      employee_name: "", employee_code: "", store_password: "",
    };
    for (const k of Object.keys(row)) {
      const mapped = keyMap[k.trim().toLowerCase()];
      if (mapped) out[mapped] = String(row[k] ?? "").trim();
    }
    return out;
  });
}

function ImportTab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState<string>("");
  type PreviewData = Awaited<ReturnType<typeof previewImport>>;
  type CommitData = Awaited<ReturnType<typeof commitImport>>;
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<CommitData | null>(null);
  const qc = useQueryClient();

  const previewFn = useServerFn(previewImport);
  const commitFn = useServerFn(commitImport);

  const previewMut = useMutation({
    mutationFn: (data: ParsedRow[]) => previewFn({ data: { rows: data } }),
    onSuccess: (d) => setPreview(d),
    onError: (e: Error) => toast.error(e.message),
  });

  const commitMut = useMutation({
    mutationFn: (data: ParsedRow[]) => commitFn({ data: { rows: data } }),
    onSuccess: (d) => {
      setResult(d);
      setPreview(null);
      setRows(null);
      qc.invalidateQueries({ queryKey: ["admin-all"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Import complete");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onTemplate = () => {
    downloadCSV("import-template.csv", [
      [...HEADERS],
      ["Acme", "ST001", "Acme Downtown", "North", "Jane Doe", "EMP001", "ChangeMe123"],
    ]);
  };

  const onFile = async (file: File) => {
    setFileName(file.name);
    setPreview(null);
    setResult(null);
    try {
      let raw: Record<string, unknown>[] = [];
      if (/\.xlsx?$/i.test(file.name)) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        raw = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      } else {
        const text = await file.text();
        const res = Papa.parse<Record<string, unknown>>(text, {
          header: true, skipEmptyLines: true,
        });
        raw = res.data;
      }
      const parsed = normalizeHeaderRow(raw);
      setRows(parsed);
      previewMut.mutate(parsed);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to parse file");
    }
  };

  const onConfirm = () => { if (rows) commitMut.mutate(rows); };
  const onCancel = () => { setRows(null); setPreview(null); setFileName(""); if (fileRef.current) fileRef.current.value = ""; };

  const reset = () => { setResult(null); setRows(null); setPreview(null); setFileName(""); if (fileRef.current) fileRef.current.value = ""; };

  const downloadErrorLog = (errors: { rowNumber: number; reason: string }[]) => {
    downloadCSV("import-errors.csv", [["Row", "Reason"], ...errors.map((e) => [String(e.rowNumber), e.reason])]);
  };

  // Result screen
  if (result) {
    const s = result.summary;
    return (
      <div className="space-y-4 mt-4">
        <div className="rounded-xl border bg-card p-6 space-y-3">
          <h3 className="text-lg font-semibold">Import complete</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat label="Rows processed" value={s.processed}/>
            <Stat label="Skipped" value={s.skipped}/>
            <Stat label="New brands" value={s.createdBrands}/>
            <Stat label="New stores" value={s.createdStores}/>
            <Stat label="Updated stores" value={s.updatedStores}/>
            <Stat label="New employees" value={s.createdEmployees}/>
            <Stat label="Updated employees" value={s.updatedEmployees}/>
            <Stat label="New users" value={s.createdUsers}/>
            <Stat label="Passwords reset" value={s.updatedPasswords}/>
          </div>
          <div className="flex gap-2 pt-2">
            {result.errors.length > 0 && (
              <Button variant="outline" onClick={() => downloadErrorLog(result.errors)}>
                <Download className="size-4"/> Download error log ({result.errors.length})
              </Button>
            )}
            <Button onClick={reset}>Import another file</Button>
          </div>
        </div>
        {result.errors.length > 0 && (
          <div className="rounded-xl border bg-card p-4">
            <h4 className="font-medium mb-2">Skipped rows</h4>
            <ul className="text-sm space-y-1 max-h-64 overflow-y-auto">
              {result.errors.map((e, i) => (
                <li key={i}><span className="text-muted-foreground">Row {e.rowNumber}:</span> {e.reason}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // Preview screen
  if (preview && rows) {
    const s = preview.summary;
    return (
      <div className="space-y-4 mt-4">
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-semibold">Preview: {fileName}</h3>
              <p className="text-xs text-muted-foreground">Existing records not in this file will be left as-is. Historical audits are never touched.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel}>Cancel</Button>
              <Button onClick={onConfirm} disabled={commitMut.isPending || s.validRows === 0}>
                {commitMut.isPending ? "Importing…" : `Confirm import (${s.validRows})`}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat label="Total rows" value={s.totalRows}/>
            <Stat label="Valid" value={s.validRows}/>
            <Stat label="Skipped" value={s.skipped}/>
            <Stat label="New brands" value={s.newBrands}/>
            <Stat label="New stores" value={s.newStores}/>
            <Stat label="Updated stores" value={s.updatedStores}/>
            <Stat label="New employees" value={s.newEmployees}/>
            <Stat label="Updated employees" value={s.updatedEmployees}/>
            <Stat label="New users" value={s.newUsers}/>
            <Stat label="Passwords to reset" value={s.updatedPasswords}/>
          </div>
        </div>

        <div className="rounded-xl border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground border-b">
              <tr>
                <th className="py-2 px-3">Row</th>
                <th className="py-2 px-3">Brand</th>
                <th className="py-2 px-3">Store</th>
                <th className="py-2 px-3">Employee</th>
                <th className="py-2 px-3">Brand</th>
                <th className="py-2 px-3">Store</th>
                <th className="py-2 px-3">Employee</th>
                <th className="py-2 px-3">Login</th>
              </tr>
            </thead>
            <tbody>
              {preview.preview.map((p) => (
                <tr key={p.rowNumber} className="border-b last:border-0">
                  <td className="py-2 px-3 text-muted-foreground">{p.rowNumber}</td>
                  <td className="py-2 px-3">{p.brand_name}</td>
                  <td className="py-2 px-3">{p.store_code} <span className="text-muted-foreground">— {p.store_name}</span></td>
                  <td className="py-2 px-3">{p.employee_code} <span className="text-muted-foreground">— {p.employee_name}</span></td>
                  <td className="py-2 px-3"><StatusBadge s={p.brandStatus}/></td>
                  <td className="py-2 px-3"><StatusBadge s={p.storeStatus}/></td>
                  <td className="py-2 px-3"><StatusBadge s={p.empStatus}/></td>
                  <td className="py-2 px-3"><StatusBadge s={p.userStatus === "password_update" ? "update" : "create"}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {preview.errors.length > 0 && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-destructive">Skipped rows ({preview.errors.length})</h4>
              <Button size="sm" variant="outline" onClick={() => downloadErrorLog(preview.errors)}>
                <Download className="size-4"/> Download
              </Button>
            </div>
            <ul className="text-sm space-y-1 max-h-48 overflow-y-auto">
              {preview.errors.map((e, i) => (
                <li key={i}><span className="text-muted-foreground">Row {e.rowNumber}:</span> {e.reason}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // Upload screen
  return (
    <div className="space-y-4 mt-4">
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-lg font-semibold">Bulk import</h3>
            <p className="text-sm text-muted-foreground max-w-prose">
              Upload a CSV or XLSX with brands, stores, employees, and store login passwords.
              Existing records are matched by <strong>Store Code</strong> and <strong>Employee Code</strong> and updated; missing ones are created.
              Historical audits are never modified.
            </p>
          </div>
          <Button variant="outline" onClick={onTemplate}>
            <Download className="size-4"/> Download CSV template
          </Button>
        </div>

        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          <Upload className="size-8 mx-auto text-muted-foreground mb-3"/>
          <p className="text-sm mb-3">Drop a .csv or .xlsx file, or pick from your computer</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={previewMut.isPending}>
            {previewMut.isPending ? "Parsing…" : "Choose file"}
          </Button>
          {fileName && <p className="text-xs text-muted-foreground mt-2">{fileName}</p>}
        </div>

        <div className="text-xs text-muted-foreground">
          <p className="font-medium mb-1">Expected columns (in any order):</p>
          <code className="text-[11px]">{HEADERS.join(" · ")}</code>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    create: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    update: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    exists: "bg-muted text-muted-foreground",
  };
  const label = s === "create" ? "Create" : s === "update" ? "Update" : "No change";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[s] ?? "bg-muted"}`}>{label}</span>;
}

