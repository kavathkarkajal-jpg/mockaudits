import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AppRole =
  | "store_manager"
  | "regional_manager"
  | "trainer"
  | "operations_head"
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
    let reauditSet = new Set<string>();
    if (empIds.length) {
      const { data: sessions } = await supabase
        .from("audit_sessions")
        .select("employee_id, score, needs_reaudit")
        .eq("week_start_date", monday)
        .in("employee_id", empIds);
      completedSet = new Set((sessions ?? []).map((s) => s.employee_id));
      reauditSet = new Set((sessions ?? []).filter((s) => s.needs_reaudit).map((s) => s.employee_id));
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
      needsReaudit: reauditSet.has(e.id),
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
      .select("id, score, submitted_at, week_start_date, needs_reaudit")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ------- Toggle re-audit flag -------
export const toggleReauditFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ session_id: z.string().uuid(), needs_reaudit: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("audit_sessions")
      .update({
        needs_reaudit: data.needs_reaudit,
        reaudit_cleared_at: data.needs_reaudit ? null : new Date().toISOString(),
      })
      .eq("id", data.session_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// ------- Dashboard -------
export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const monday = mondayISO();
    const weeks = lastNMondays(8);

    // Determine caller's brand scope
    const [{ data: roleRow }, { data: profileRow }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      supabase.from("profiles").select("brand_id").eq("id", userId).maybeSingle(),
    ]);
    const role = roleRow?.role as string | undefined;
    const scopedBrandId =
      role && !["admin", "trainer"].includes(role) ? profileRow?.brand_id ?? null : null;

    const brandsQ = supabase.from("brands").select("id, name, primary_color");
    const storesQ = supabase.from("stores").select("id, brand_id, store_code, store_name, region");
    if (scopedBrandId) {
      brandsQ.eq("id", scopedBrandId);
      storesQ.eq("brand_id", scopedBrandId);
    }

    const [{ data: brands }, { data: stores }, { data: employees }] =
      await Promise.all([
        brandsQ,
        storesQ,
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
          .select("employee_id, week_start_date, score, needs_reaudit")
          .gte("week_start_date", weeks[0])
          .in("employee_id", empIds)
      : { data: [] as Array<{ employee_id: string; week_start_date: string; score: number; needs_reaudit: boolean }> };

    const storeById = new Map((stores ?? []).map((s) => [s.id, s]));
    const empToStore = new Map((employees ?? []).map((e) => [e.id, e.store_id]));

    // Current-week completion sets per store/brand
    const currentWeekCompleted = new Set(
      (weekSessions ?? []).filter((s) => s.week_start_date === monday).map((s) => s.employee_id),
    );
    const currentWeekReaudit = new Set(
      (weekSessions ?? [])
        .filter((s) => s.week_start_date === monday && s.needs_reaudit)
        .map((s) => s.employee_id),
    );

    const storeStats = (stores ?? []).map((s) => {
      const due = empByStore.get(s.id) ?? 0;
      let done = 0;
      let flagged = 0;
      (employees ?? [])
        .filter((e) => e.store_id === s.id)
        .forEach((e) => {
          if (currentWeekCompleted.has(e.id)) done += 1;
          if (currentWeekReaudit.has(e.id)) flagged += 1;
        });
      return {
        store_id: s.id,
        store_code: s.store_code,
        store_name: s.store_name,
        brand_id: s.brand_id,
        region: s.region,
        due,
        completed: done,
        flagged,
        pct: due ? Math.round((done / due) * 100) : 0,
      };
    });

    const brandStats = (brands ?? []).map((b) => {
      const ss = storeStats.filter((s) => s.brand_id === b.id);
      const due = ss.reduce((a, x) => a + x.due, 0);
      const completed = ss.reduce((a, x) => a + x.completed, 0);
      const flagged = ss.reduce((a, x) => a + x.flagged, 0);
      return {
        brand_id: b.id,
        brand_name: b.name,
        color: b.primary_color,
        due,
        completed,
        flagged,
        pending: Math.max(due - completed, 0),
        pct: due ? Math.round((completed / due) * 100) : 0,
      };
    });

    const totalDue = brandStats.reduce((a, x) => a + x.due, 0);
    const totalCompleted = brandStats.reduce((a, x) => a + x.completed, 0);
    const totalFlagged = brandStats.reduce((a, x) => a + x.flagged, 0);

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
        totalFlagged,
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
        reaudit_threshold: z.number().min(0).max(100).nullable().default(null),
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
  "operations_head",
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

export const updateUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
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
    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        brand_id: data.brand_id ?? null,
        store_id: data.store_id ?? null,
        region: data.region ?? null,
      })
      .eq("id", data.id);
    if (pErr) throw new Error(pErr.message);
    const { error: rDelErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.id);
    if (rDelErr) throw new Error(rDelErr.message);
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.id, role: data.role });
    if (rErr) throw new Error(rErr.message);
    return { ok: true };
  });

// ------- Questions: list for a brand (any authenticated user) -------
export const listQuestionsForBrand = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ brand_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("audit_questions")
      .select("id, brand_id, section_id, question_text, question_type, display_order, options, required, max_score")
      .eq("brand_id", data.brand_id)
      .order("display_order", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ------- ADMIN: questions list (all brands) -------
export const adminListQuestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("audit_questions")
      .select("id, brand_id, section_id, question_text, question_type, display_order, options, required, max_score")
      .order("brand_id")
      .order("display_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const QuestionTypeEnum = z.enum([
  "yes_no",
  "single_choice",
  "multi_choice",
  "short_text",
  "long_text",
  "rating_stars",
  "rating_number",
  "likert",
  "date",
  "ranking",
]);

export const upsertQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        brand_id: z.string().uuid(),
        section_id: z.string().uuid().nullable().optional(),
        question_text: z.string().min(1).max(1000),
        question_type: QuestionTypeEnum.default("yes_no"),
        options: z.any().optional(),
        required: z.boolean().optional(),
        max_score: z.number().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const payload = {
      question_text: data.question_text,
      question_type: data.question_type,
      options: data.options ?? [],
      required: data.required ?? false,
      max_score: data.max_score ?? 0,
      section_id: data.section_id ?? null,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("audit_questions")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { data: maxRow } = await context.supabase
        .from("audit_questions")
        .select("display_order")
        .eq("brand_id", data.brand_id)
        .order("display_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextOrder = (maxRow?.display_order ?? -1) + 1;
      const { error } = await context.supabase.from("audit_questions").insert({
        brand_id: data.brand_id,
        ...payload,
        display_order: nextOrder,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });


export const deleteQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("audit_questions")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        brand_id: z.string().uuid(),
        ordered_ids: z.array(z.string().uuid()).min(1).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    // Update each row's display_order. Small N expected per brand.
    for (let i = 0; i < data.ordered_ids.length; i++) {
      const { error } = await context.supabase
        .from("audit_questions")
        .update({ display_order: i })
        .eq("id", data.ordered_ids[i])
        .eq("brand_id", data.brand_id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ------- ADMIN: bulk CSV import -------
const ImportRowSchema = z.object({
  brand_name: z.string().trim().max(120).default(""),
  store_code: z.string().trim().max(40).default(""),
  store_name: z.string().trim().max(120).default(""),
  region: z.string().trim().max(80).default(""),
  employee_name: z.string().trim().max(120).default(""),
  employee_code: z.string().trim().max(40).default(""),
  store_password: z.string().max(72).default(""),
});

const ImportInput = z.object({
  rows: z.array(ImportRowSchema).max(5000),
});

type RowIssue = { rowNumber: number; reason: string };
type ImportRow = z.infer<typeof ImportRowSchema> & { rowNumber: number };

function analyzeRows(rows: z.infer<typeof ImportRowSchema>[]) {
  const errors: RowIssue[] = [];
  const valid: ImportRow[] = [];
  const seenEmpCodes = new Map<string, number>();

  rows.forEach((r, i) => {
    const rowNumber = i + 2;
    const empty =
      !r.brand_name && !r.store_code && !r.store_name && !r.region &&
      !r.employee_name && !r.employee_code && !r.store_password;
    if (empty) return;

    const missing: string[] = [];
    if (!r.brand_name) missing.push("Brand Name");
    if (!r.store_code) missing.push("Store Code");
    if (!r.employee_code) missing.push("Employee Code");
    if (!r.store_password) missing.push("Store Password");
    if (missing.length) {
      errors.push({ rowNumber, reason: `Missing required: ${missing.join(", ")}` });
      return;
    }
    if (r.store_password.length < 6) {
      errors.push({ rowNumber, reason: "Store Password must be at least 6 characters" });
      return;
    }
    const key = r.employee_code.toLowerCase();
    if (seenEmpCodes.has(key)) {
      errors.push({
        rowNumber,
        reason: `Duplicate Employee Code "${r.employee_code}" (also on row ${seenEmpCodes.get(key)})`,
      });
      return;
    }
    seenEmpCodes.set(key, rowNumber);
    valid.push({ ...r, rowNumber });
  });

  return { valid, errors };
}

export const previewImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ImportInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { valid, errors } = analyzeRows(data.rows);

    const [{ data: brands }, { data: stores }, { data: employees }, { data: profiles }] =
      await Promise.all([
        supabaseAdmin.from("brands").select("id, name"),
        supabaseAdmin.from("stores").select("id, store_code, store_name, region, brand_id"),
        supabaseAdmin.from("employees").select("id, employee_code, name, store_id"),
        supabaseAdmin.from("profiles").select("id, store_code"),
      ]);

    const brandByName = new Map((brands ?? []).map((b) => [b.name.toLowerCase(), b]));
    const storeByCode = new Map((stores ?? []).map((s) => [s.store_code.toLowerCase(), s]));
    const empByCode = new Map((employees ?? []).map((e) => [e.employee_code.toLowerCase(), e]));
    const profileByStoreCode = new Map(
      (profiles ?? []).map((p) => [p.store_code.toLowerCase(), p]),
    );

    const newBrandKeys = new Set<string>();
    let newStores = 0, updatedStores = 0;
    let newEmployees = 0, updatedEmployees = 0;
    let newUsers = 0, updatedPasswords = 0;

    const preview = valid.map((r) => {
      const brandKey = r.brand_name.toLowerCase();
      const brandStatus = brandByName.has(brandKey) ? "exists" : "create";
      if (brandStatus === "create") newBrandKeys.add(brandKey);

      const existingStore = storeByCode.get(r.store_code.toLowerCase());
      let storeStatus: "create" | "update" | "exists" = "create";
      if (existingStore) {
        const changed =
          (r.store_name && existingStore.store_name !== r.store_name) ||
          (r.region && existingStore.region !== r.region);
        storeStatus = changed ? "update" : "exists";
      }
      if (storeStatus === "create") newStores++;
      else if (storeStatus === "update") updatedStores++;

      const existingEmp = empByCode.get(r.employee_code.toLowerCase());
      let empStatus: "create" | "update" | "exists" = "create";
      if (existingEmp) {
        empStatus = existingEmp.name !== r.employee_name ? "update" : "exists";
      }
      if (empStatus === "create") newEmployees++;
      else if (empStatus === "update") updatedEmployees++;

      const hasUser = profileByStoreCode.has(r.store_code.toLowerCase());
      if (hasUser) updatedPasswords++;
      else newUsers++;

      return {
        rowNumber: r.rowNumber,
        brand_name: r.brand_name,
        store_code: r.store_code,
        store_name: r.store_name,
        region: r.region || "Default",
        employee_name: r.employee_name,
        employee_code: r.employee_code,
        brandStatus,
        storeStatus,
        empStatus,
        userStatus: hasUser ? "password_update" : "create",
      };
    });

    return {
      preview,
      errors,
      summary: {
        totalRows: data.rows.length,
        validRows: valid.length,
        skipped: errors.length,
        newBrands: newBrandKeys.size,
        newStores,
        updatedStores,
        newEmployees,
        updatedEmployees,
        newUsers,
        updatedPasswords,
      },
    };
  });

export const commitImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ImportInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { valid, errors } = analyzeRows(data.rows);

    const [{ data: brands }, { data: stores }, { data: employees }, { data: profiles }] =
      await Promise.all([
        supabaseAdmin.from("brands").select("id, name"),
        supabaseAdmin.from("stores").select("id, store_code, store_name, region, brand_id"),
        supabaseAdmin.from("employees").select("id, employee_code, name, store_id"),
        supabaseAdmin.from("profiles").select("id, store_code"),
      ]);

    const brandByName = new Map((brands ?? []).map((b) => [b.name.toLowerCase(), { ...b }]));
    const storeByCode = new Map(
      (stores ?? []).map((s) => [s.store_code.toLowerCase(), { ...s }]),
    );
    const empByCode = new Map(
      (employees ?? []).map((e) => [e.employee_code.toLowerCase(), { ...e }]),
    );
    const profileByStoreCode = new Map(
      (profiles ?? []).map((p) => [p.store_code.toLowerCase(), { ...p }]),
    );

    let createdBrands = 0, createdStores = 0, updatedStores = 0;
    let createdEmployees = 0, updatedEmployees = 0;
    let createdUsers = 0, updatedPasswords = 0;
    let processed = 0;
    const rowErrors: RowIssue[] = [...errors];

    for (const r of valid) {
      try {
        const brandKey = r.brand_name.toLowerCase();
        let brand = brandByName.get(brandKey);
        if (!brand) {
          const { data: ins, error } = await supabaseAdmin
            .from("brands")
            .insert({ name: r.brand_name })
            .select("id, name")
            .single();
          if (error || !ins) throw new Error(`Brand insert failed: ${error?.message}`);
          brand = ins;
          brandByName.set(brandKey, brand);
          createdBrands++;
        }

        const storeKey = r.store_code.toLowerCase();
        let store = storeByCode.get(storeKey);
        const region = r.region || "Default";
        if (!store) {
          const { data: ins, error } = await supabaseAdmin
            .from("stores")
            .insert({
              brand_id: brand.id,
              store_code: r.store_code,
              store_name: r.store_name || r.store_code,
              region,
            })
            .select("id, store_code, store_name, region, brand_id")
            .single();
          if (error || !ins) throw new Error(`Store insert failed: ${error?.message}`);
          store = ins;
          storeByCode.set(storeKey, store);
          createdStores++;
        } else {
          const newName = r.store_name || store.store_name;
          const needs =
            store.store_name !== newName ||
            store.region !== region ||
            store.brand_id !== brand.id;
          if (needs) {
            const { error } = await supabaseAdmin
              .from("stores")
              .update({ store_name: newName, region, brand_id: brand.id })
              .eq("id", store.id);
            if (error) throw new Error(`Store update failed: ${error.message}`);
            store.store_name = newName;
            store.region = region;
            store.brand_id = brand.id;
            updatedStores++;
          }
        }

        const existingProfile = profileByStoreCode.get(storeKey);
        if (existingProfile) {
          const { error } = await supabaseAdmin.auth.admin.updateUserById(existingProfile.id, {
            password: r.store_password,
          });
          if (error) throw new Error(`Password update failed: ${error.message}`);
          await supabaseAdmin
            .from("profiles")
            .update({
              brand_id: brand.id,
              store_id: store.id,
              region,
              full_name: r.store_name || existingProfile.store_code,
            })
            .eq("id", existingProfile.id);
          updatedPasswords++;
        } else {
          const email = synthEmail(r.store_code);
          const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: r.store_password,
            email_confirm: true,
          });
          if (cErr || !created.user) throw new Error(`User create failed: ${cErr?.message}`);
          const newId = created.user.id;
          const { error: pErr } = await supabaseAdmin.from("profiles").insert({
            id: newId,
            store_code: r.store_code,
            full_name: r.store_name || r.store_code,
            brand_id: brand.id,
            store_id: store.id,
            region,
          });
          if (pErr) {
            await supabaseAdmin.auth.admin.deleteUser(newId);
            throw new Error(`Profile insert failed: ${pErr.message}`);
          }
          const { error: rErr } = await supabaseAdmin
            .from("user_roles")
            .insert({ user_id: newId, role: "store_manager" });
          if (rErr) throw new Error(`Role insert failed: ${rErr.message}`);
          profileByStoreCode.set(storeKey, { id: newId, store_code: r.store_code });
          createdUsers++;
        }

        const empKey = r.employee_code.toLowerCase();
        const existingEmp = empByCode.get(empKey);
        if (!existingEmp) {
          const { data: ins, error } = await supabaseAdmin
            .from("employees")
            .insert({
              store_id: store.id,
              employee_code: r.employee_code,
              name: r.employee_name || r.employee_code,
              active: true,
            })
            .select("id, employee_code, name, store_id")
            .single();
          if (error || !ins) throw new Error(`Employee insert failed: ${error?.message}`);
          empByCode.set(empKey, ins);
          createdEmployees++;
        } else {
          const newName = r.employee_name || existingEmp.name;
          const needs = existingEmp.name !== newName || existingEmp.store_id !== store.id;
          if (needs) {
            const { error } = await supabaseAdmin
              .from("employees")
              .update({ name: newName, store_id: store.id, active: true })
              .eq("id", existingEmp.id);
            if (error) throw new Error(`Employee update failed: ${error.message}`);
            existingEmp.name = newName;
            existingEmp.store_id = store.id;
            updatedEmployees++;
          }
        }
        processed++;
      } catch (e) {
        rowErrors.push({
          rowNumber: r.rowNumber,
          reason: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    return {
      ok: true,
      summary: {
        totalRows: data.rows.length,
        processed,
        createdBrands,
        createdStores,
        updatedStores,
        createdEmployees,
        updatedEmployees,
        createdUsers,
        updatedPasswords,
        skipped: rowErrors.length,
      },
      errors: rowErrors,
    };
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

export const listStores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const monday = mondayISO();
    const { data: profile } = await supabase.from("profiles").select("brand_id, store_id, region").eq("id", context.userId).maybeSingle();
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", context.userId);
    const role = roles?.[0]?.role ?? null;
    let q = supabase.from("stores").select("id, store_code, store_name, region, brand_id, brands(id, name, primary_color)").order("store_name");
    if (role === "admin") { /* no filter */ }
    else if (["trainer","operations_head","business_head","regional_manager"].includes(role ?? "") && profile?.brand_id) { q = q.eq("brand_id", profile.brand_id); if (role === "regional_manager" && profile?.region) q = q.eq("region", profile.region); }
    else if (role === "store_manager" && profile?.store_id) { q = q.eq("id", profile.store_id); }
    const { data: stores, error } = await q;
    if (error) throw new Error(error.message);
    const storeIds = (stores ?? []).map((s) => s.id);
    let completionMap: Record<string, { total: number; completed: number }> = {};
    if (storeIds.length) {
      const { data: emps } = await supabase.from("employees").select("id, store_id").in("store_id", storeIds).eq("active", true);
      const empIds = (emps ?? []).map((e) => e.id);
      let completedIds = new Set<string>();
      if (empIds.length) { const { data: sessions } = await supabase.from("audit_sessions").select("employee_id").eq("week_start_date", monday).in("employee_id", empIds); completedIds = new Set((sessions ?? []).map((s) => s.employee_id)); }
      for (const emp of emps ?? []) { if (!completionMap[emp.store_id]) completionMap[emp.store_id] = { total: 0, completed: 0 }; completionMap[emp.store_id]!.total++; if (completedIds.has(emp.id)) completionMap[emp.store_id]!.completed++; }
    }
    return (stores ?? []).map((s) => ({ id: s.id, code: s.store_code, name: s.store_name, region: s.region, brand: s.brands ? { id: (s.brands as any).id, name: (s.brands as any).name, color: (s.brands as any).primary_color } : null, completion: completionMap[s.id] ?? { total: 0, completed: 0 } }));
  });

export const listEmployeesByStore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ store_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const monday = mondayISO();
    const { data: employees, error } = await supabase.from("employees").select("id, name, employee_code, store_id, stores(id, store_code, store_name, brand_id, region, brands(id, name, primary_color))").eq("store_id", data.store_id).eq("active", true).order("name");
    if (error) throw new Error(error.message);
    const empIds = (employees ?? []).map((e) => e.id);
    let completedSet = new Set<string>(); let reauditSet = new Set<string>();
    if (empIds.length) { const { data: sessions } = await supabase.from("audit_sessions").select("employee_id, needs_reaudit").eq("week_start_date", monday).in("employee_id", empIds); completedSet = new Set((sessions ?? []).map((s) => s.employee_id)); reauditSet = new Set((sessions ?? []).filter((s) => s.needs_reaudit).map((s) => s.employee_id)); }
    return (employees ?? []).map((e) => ({ id: e.id, name: e.name, employee_code: e.employee_code, store: e.stores ? { id: (e.stores as any).id, code: (e.stores as any).store_code, name: (e.stores as any).store_name, region: (e.stores as any).region, brand: (e.stores as any).brands ? { id: (e.stores as any).brands.id, name: (e.stores as any).brands.name, color: (e.stores as any).brands.primary_color } : null } : null, completedThisWeek: completedSet.has(e.id), needsReaudit: reauditSet.has(e.id) }));
  });

export const getStore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ store_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: store, error } = await context.supabase.from("stores").select("id, store_code, store_name, region, brand_id, brands(id, name, primary_color)").eq("id", data.store_id).maybeSingle();
    if (error) throw new Error(error.message);
    return store ? { id: store.id, code: store.store_code, name: store.store_name, region: store.region, brand: store.brands ? { id: (store.brands as any).id, name: (store.brands as any).name, color: (store.brands as any).primary_color } : null } : null;
  });

export const trainerUpsertEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid().optional(), store_id: z.string().uuid(), name: z.string().min(1).max(120), employee_code: z.string().min(1).max(40), active: z.boolean().default(true) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const role = roles?.[0]?.role;
    if (role !== "admin" && role !== "trainer") throw new Error("Forbidden");
    if (role === "trainer") { const { data: profile } = await supabase.from("profiles").select("brand_id").eq("id", userId).maybeSingle(); const { data: store } = await supabase.from("stores").select("brand_id").eq("id", data.store_id).maybeSingle(); if (!profile?.brand_id || profile.brand_id !== store?.brand_id) throw new Error("Forbidden: store not in your brand"); }
    const { error } = await supabase.from("employees").upsert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const trainerDeleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const role = roles?.[0]?.role;
    if (role !== "admin" && role !== "trainer") throw new Error("Forbidden");
    if (role === "trainer") { const { data: profile } = await supabase.from("profiles").select("brand_id").eq("id", userId).maybeSingle(); const { data: emp } = await supabase.from("employees").select("store_id, stores(brand_id)").eq("id", data.id).maybeSingle(); const storeBrand = (emp?.stores as any)?.brand_id; if (!profile?.brand_id || profile.brand_id !== storeBrand) throw new Error("Forbidden"); }
    const { error } = await supabase.from("employees").update({ active: false }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


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
