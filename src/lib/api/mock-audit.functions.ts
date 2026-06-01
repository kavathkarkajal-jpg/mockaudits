import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AppRole =
  | "store_manager"
  | "regional_manager"
  | "trainer"
  | "business_head"
  | "admin";

// ------- Profile / role of current user -------
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, store_code, full_name, brand_id, store_id, region")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const role = (roles?.[0]?.role ?? null) as AppRole | null;
    return { profile, role };
  });

// ------- Employees list (scoped by RLS) -------
export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const monday = mondayISO();

    const { data: employees, error } = await supabase
      .from("employees")
      .select(
        "id, name, employee_code, active, store_id, stores(id, store_code, store_name, brand_id, region, brands(id, name, primary_color))",
      )
      .eq("active", true)
      .order("name");
    if (error) throw new Error(error.message);

    const empIds = (employees ?? []).map((e) => e.id);
    let completedSet = new Set<string>();
    if (empIds.length) {
      const { data: sessions } = await supabase
        .from("audit_sessions")
        .select("employee_id, score")
        .eq("week_start_date", monday)
        .in("employee_id", empIds);
      completedSet = new Set((sessions ?? []).map((s) => s.employee_id));
    }

    return (employees ?? []).map((e) => ({
      id: e.id,
      name: e.name,
      employee_code: e.employee_code,
      store: e.stores
        ? {
            id: e.stores.id,
            code: e.stores.store_code,
            name: e.stores.store_name,
            region: e.stores.region,
            brand: e.stores.brands
              ? {
                  id: e.stores.brands.id,
                  name: e.stores.brands.name,
                  color: e.stores.brands.primary_color,
                }
              : null,
          }
        : null,
      completedThisWeek: completedSet.has(e.id),
    }));
  });

// ------- Submit audit -------
export const submitAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        employee_id: z.string().uuid(),
        score: z.number().min(0).max(100),
        notes: z.string().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("audit_sessions")
      .insert({
        employee_id: data.employee_id,
        conducted_by: userId,
        score: data.score,
        notes: data.notes ?? null,
        week_start_date: mondayISO(), // trigger will overwrite, but satisfy NOT NULL
      })
      .select("id, score, submitted_at, week_start_date")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ------- Dashboard -------
export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const monday = mondayISO();
    const weeks = lastNMondays(8);

    const [{ data: brands }, { data: stores }, { data: employees }] =
      await Promise.all([
        supabase.from("brands").select("id, name, primary_color"),
        supabase.from("stores").select("id, brand_id, store_code, store_name, region"),
        supabase.from("employees").select("id, store_id").eq("active", true),
      ]);

    const empByStore = new Map<string, number>();
    (employees ?? []).forEach((e) => {
      empByStore.set(e.store_id, (empByStore.get(e.store_id) ?? 0) + 1);
    });
    const empIds = (employees ?? []).map((e) => e.id);

    const { data: weekSessions } = empIds.length
      ? await supabase
          .from("audit_sessions")
          .select("employee_id, week_start_date, score")
          .gte("week_start_date", weeks[0])
          .in("employee_id", empIds)
      : { data: [] as Array<{ employee_id: string; week_start_date: string; score: number }> };

    const storeById = new Map((stores ?? []).map((s) => [s.id, s]));
    const empToStore = new Map((employees ?? []).map((e) => [e.id, e.store_id]));

    // Current-week completion sets per store/brand
    const currentWeekCompleted = new Set(
      (weekSessions ?? []).filter((s) => s.week_start_date === monday).map((s) => s.employee_id),
    );

    const storeStats = (stores ?? []).map((s) => {
      const due = empByStore.get(s.id) ?? 0;
      let done = 0;
      (employees ?? [])
        .filter((e) => e.store_id === s.id)
        .forEach((e) => {
          if (currentWeekCompleted.has(e.id)) done += 1;
        });
      return {
        store_id: s.id,
        store_code: s.store_code,
        store_name: s.store_name,
        brand_id: s.brand_id,
        region: s.region,
        due,
        completed: done,
        pct: due ? Math.round((done / due) * 100) : 0,
      };
    });

    const brandStats = (brands ?? []).map((b) => {
      const ss = storeStats.filter((s) => s.brand_id === b.id);
      const due = ss.reduce((a, x) => a + x.due, 0);
      const completed = ss.reduce((a, x) => a + x.completed, 0);
      return {
        brand_id: b.id,
        brand_name: b.name,
        color: b.primary_color,
        due,
        completed,
        pending: Math.max(due - completed, 0),
        pct: due ? Math.round((completed / due) * 100) : 0,
      };
    });

    const totalDue = brandStats.reduce((a, x) => a + x.due, 0);
    const totalCompleted = brandStats.reduce((a, x) => a + x.completed, 0);

    // Week-on-week trend (last 8 weeks): completed unique employees / due (constant per current employees)
    const trend = weeks.map((w) => {
      const completedEmps = new Set(
        (weekSessions ?? [])
          .filter((s) => s.week_start_date === w && empToStore.has(s.employee_id))
          .map((s) => s.employee_id),
      );
      return {
        week: w,
        completed: completedEmps.size,
        due: empIds.length,
        pct: empIds.length ? Math.round((completedEmps.size / empIds.length) * 100) : 0,
      };
    });

    return {
      monday,
      summary: {
        totalDue,
        totalCompleted,
        totalPending: Math.max(totalDue - totalCompleted, 0),
        pct: totalDue ? Math.round((totalCompleted / totalDue) * 100) : 0,
      },
      brandStats,
      storeStats,
      trend,
    };
  });

// ------- ADMIN: lists -------
export const adminListAll = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    await assertAdmin(supabase, context.userId);
    const [{ data: brands }, { data: stores }, { data: employees }, { data: profiles }, { data: roles }] =
      await Promise.all([
        supabase.from("brands").select("*").order("name"),
        supabase.from("stores").select("*").order("store_name"),
        supabase.from("employees").select("*").order("name"),
        supabase.from("profiles").select("*").order("store_code"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
    return {
      brands: brands ?? [],
      stores: stores ?? [],
      employees: employees ?? [],
      profiles: profiles ?? [],
      roles: roles ?? [],
    };
  });

// ------- ADMIN: brand CRUD -------
export const upsertBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(120),
        primary_color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .default("#0EA5E9"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("brands").upsert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("brands").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------- ADMIN: store CRUD -------
export const upsertStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        brand_id: z.string().uuid(),
        store_code: z.string().min(1).max(40),
        store_name: z.string().min(1).max(120),
        region: z.string().min(1).max(80).default("Default"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("stores").upsert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("stores").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------- ADMIN: employee CRUD -------
export const upsertEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        store_id: z.string().uuid(),
        name: z.string().min(1).max(120),
        employee_code: z.string().min(1).max(40),
        active: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("employees").upsert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    // Soft delete to preserve historical audits
    const { error } = await context.supabase
      .from("employees")
      .update({ active: false })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------- ADMIN: users -------
const RoleEnum = z.enum([
  "store_manager",
  "regional_manager",
  "trainer",
  "business_head",
  "admin",
]);

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        store_code: z
          .string()
          .min(2)
          .max(40)
          .regex(/^[A-Za-z0-9_-]+$/),
        password: z.string().min(6).max(72),
        full_name: z.string().min(1).max(120),
        role: RoleEnum,
        brand_id: z.string().uuid().nullable().optional(),
        store_id: z.string().uuid().nullable().optional(),
        region: z.string().max(80).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const email = synthEmail(data.store_code);

    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
    });
    if (cErr || !created.user) throw new Error(cErr?.message ?? "Failed to create user");
    const newId = created.user.id;

    const { error: pErr } = await supabaseAdmin.from("profiles").insert({
      id: newId,
      store_code: data.store_code,
      full_name: data.full_name,
      brand_id: data.brand_id ?? null,
      store_id: data.store_id ?? null,
      region: data.region ?? null,
    });
    if (pErr) {
      await supabaseAdmin.auth.admin.deleteUser(newId);
      throw new Error(pErr.message);
    }
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newId, role: data.role });
    if (rErr) throw new Error(rErr.message);

    return { ok: true, user_id: newId };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), password: z.string().min(6).max(72) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------- helpers -------
function synthEmail(storeCode: string) {
  return `${storeCode.toLowerCase()}@mockaudit.app`;
}

function mondayISO(d: Date = new Date()) {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = dt.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
}

function lastNMondays(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i * 7);
    out.push(mondayISO(d));
  }
  return out;
}

async function assertAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin role required");
}
