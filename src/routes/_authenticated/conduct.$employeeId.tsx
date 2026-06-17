import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  listEmployees,
  listQuestionsForBrand,
  submitAudit,
  toggleReauditFlag,
} from "@/lib/api/mock-audit.functions";
import {
  type Answer, type ChoiceOption, type LikertOptions, type QuestionType, type RatingOptions,
  emptyAnswer, isAnswered, scoreAnswer, computeMaxScore,
} from "@/lib/question-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Star, ArrowUp, ArrowDown, ArrowLeft, MoreVertical, Bookmark,
  CheckCircle2, ChevronRight, Trophy, Users, TrendingUp, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/conduct/$employeeId")({ component: AuditPage });

type Q = {
  id: string;
  question_text: string;
  question_type: QuestionType;
  options: unknown;
  required: boolean;
  max_score: number;
  section_id: string | null;
};

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

// Return a short label summarizing the user's answer (for the green pill).
function answerLabel(q: Q, a: Answer): string | null {
  switch (a.kind) {
    case "yes_no": return a.value === "yes" ? "Yes" : a.value === "no" ? "No" : null;
    case "single_choice": {
      const opts = (q.options as ChoiceOption[]) ?? [];
      return a.index == null ? null : opts[a.index]?.label ?? null;
    }
    case "multi_choice": {
      const opts = (q.options as ChoiceOption[]) ?? [];
      if (!a.indices.length) return null;
      const names = a.indices.map((i) => opts[i]?.label).filter(Boolean);
      return names.length <= 2 ? names.join(", ") : `${names.length} selected`;
    }
    case "text": return a.value.trim() ? (a.value.length > 40 ? a.value.slice(0, 40) + "…" : a.value) : null;
    case "rating": return a.step == null ? null : `${a.step} ${q.question_type === "rating_stars" ? "★" : "pts"}`;
    case "likert": {
      const total = a.perStatement.length;
      const done = a.perStatement.filter((v) => v !== null).length;
      return done === 0 ? null : `${done}/${total} rated`;
    }
    case "date": return a.value || null;
    case "ranking": return "Ranked";
  }
}

function AuditPage() {
  const { employeeId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchEmps = useServerFn(listEmployees);
  const fetchQuestions = useServerFn(listQuestionsForBrand);
  const submit = useServerFn(submitAudit);
  const toggleFlag = useServerFn(toggleReauditFlag);

  const { data: emps } = useQuery({ queryKey: ["employees"], queryFn: () => fetchEmps() });
  const employee = (emps ?? []).find((e) => e.id === employeeId);
  const brandId = employee?.store?.brand?.id ?? null;

  const { data: questions } = useQuery({
    queryKey: ["questions", brandId],
    queryFn: () => fetchQuestions({ data: { brand_id: brandId! } }) as Promise<Q[]>,
    enabled: !!brandId,
  });

  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<{ score: number; sessionId: string; needsReaudit: boolean } | null>(null);

  useEffect(() => {
    if (!questions) return;
    setAnswers((prev) => {
      const next: Record<string, Answer> = {};
      for (const q of questions) {
        next[q.id] = prev[q.id] ?? emptyAnswer(q.question_type, q.options);
      }
      return next;
    });
  }, [questions]);

  const totalQuestions = questions?.length ?? 0;
  const answeredCount = useMemo(
    () => (questions ?? []).filter((q) => answers[q.id] && isAnswered(answers[q.id])).length,
    [answers, questions],
  );

  const requiredOk = useMemo(
    () => (questions ?? []).every((q) => !q.required || (answers[q.id] && isAnswered(answers[q.id]))),
    [answers, questions],
  );

  const scoreFor = (qs: Q[]) => {
    const scored = qs.filter((q) => {
      const max = Number(q.max_score) || computeMaxScore(q.question_type, q.options);
      return max > 0;
    });
    if (!scored.length) return 0;
    const sum = scored.reduce((s, q) => {
      const max = Number(q.max_score) || computeMaxScore(q.question_type, q.options) || 1;
      const a = answers[q.id];
      if (!a) return s;
      const earned = scoreAnswer(q.question_type, q.options, a);
      return s + (Math.max(0, earned) / max) * 100;
    }, 0);
    return sum / scored.length;
  };

  const computedScore = useMemo(() => {
    if (!questions || questions.length === 0) return 0;
    return scoreFor(questions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, questions]);

  const sectionScores = useMemo(() => {
    if (!questions || questions.length === 0) return [] as Array<{ section_id: string | null; score: number }>;
    const groups = new Map<string | null, Q[]>();
    for (const q of questions) {
      const key = q.section_id ?? null;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(q);
    }
    return Array.from(groups.entries()).map(([section_id, qs]) => ({
      section_id,
      score: Number(scoreFor(qs).toFixed(1)),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, questions]);

  const mutation = useMutation({
    mutationFn: () =>
      submit({
        data: {
          employee_id: employeeId,
          score: Number(computedScore.toFixed(1)),
          notes: notes || undefined,
          section_scores: sectionScores,
        },
      }),
    onSuccess: (r) => {
      setResult({ score: Number(r.score), sessionId: r.id, needsReaudit: !!r.needs_reaudit });
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Audit submitted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const flagMut = useMutation({
    mutationFn: (needs: boolean) =>
      toggleFlag({ data: { session_id: result!.sessionId, needs_reaudit: needs } }),
    onSuccess: (_d, needs) => {
      setResult((p) => (p ? { ...p, needsReaudit: needs } : p));
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(needs ? "Flagged for re-audit" : "Re-audit flag cleared");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (result && employee) {
    return (
      <div className="max-w-md mx-auto rounded-2xl bg-card p-8 text-center shadow border">
        <div className="text-sm text-muted-foreground">Audit complete for</div>
        <h2 className="text-xl font-semibold">{employee.name}</h2>
        <div className={`mt-6 text-5xl font-bold ${result.needsReaudit ? "text-destructive" : "text-[oklch(0.68_0.16_150)]"}`}>
          {result.score.toFixed(1)}
        </div>
        <div className="text-xs text-muted-foreground mt-1">Score (out of 100)</div>

        {result.needsReaudit ? (
          <div className="mt-5 rounded-xl border border-destructive/50 bg-destructive/10 text-destructive p-4 text-left">
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-5 shrink-0 mt-0.5"/>
              <div className="text-sm">
                <div className="font-semibold">Flagged for re-audit</div>
                <div className="mt-1 opacity-90">Score is below the threshold for this brand. A re-audit is required.</div>
                <button
                  type="button"
                  onClick={() => flagMut.mutate(false)}
                  disabled={flagMut.isPending}
                  className="mt-2 text-xs underline underline-offset-2 hover:opacity-80 disabled:opacity-50"
                >
                  Clear flag (override)
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => flagMut.mutate(true)}
            disabled={flagMut.isPending}
            className="mt-3 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
          >
            Flag for re-audit manually
          </button>
        )}

        <div className="mt-6 flex gap-2 justify-center">
          <Button asChild variant="outline"><Link to="/conduct">Back to list</Link></Button>
          <Button onClick={() => navigate({ to: "/dashboard" })}>View Dashboard</Button>
        </div>
      </div>
    );
  }


  const setA = (id: string, a: Answer) => setAnswers((p) => ({ ...p, [id]: a }));

  const [bg, fg] = paletteFor(employee?.name ?? "?");
  const pct = totalQuestions ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const currentScore: number | null = null;
  const firstUnansweredIdx = (questions ?? []).findIndex((q) => !answers[q.id] || !isAnswered(answers[q.id]));

  return (
    <div className="-mx-4 -my-6 sm:mx-0 sm:my-0 space-y-6">
      {/* Dark navy hero */}
      <section className="bg-[oklch(0.18_0.05_255)] text-[oklch(0.985_0.003_240)] px-5 pt-5 pb-6 sm:rounded-2xl">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Link to="/conduct" aria-label="Back" className="size-9 rounded-full inline-flex items-center justify-center hover:bg-white/10">
            <ArrowLeft className="size-5"/>
          </Link>
          <div className="text-base font-semibold">Conduct Audit</div>
          <button type="button" aria-label="More" className="size-9 rounded-full inline-flex items-center justify-center hover:bg-white/10">
            <MoreVertical className="size-5"/>
          </button>
        </div>

        {/* Employee + score */}
        <div className="mt-5 flex items-center gap-3">
          <div className="size-12 rounded-full inline-flex items-center justify-center text-sm font-bold shrink-0"
               style={{ background: bg, color: fg }}>
            {initialsOf(employee?.name ?? "?")}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold leading-tight truncate">{employee?.name ?? "Employee"}</div>
            <div className="text-xs opacity-80 truncate">
              {employee?.store?.brand?.name ?? "—"} · {employee?.store?.name ?? "—"}
            </div>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-right shrink-0">
            <div className="text-[10px] uppercase tracking-wide opacity-70">Current Score</div>
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-lg font-bold text-[oklch(0.78_0.18_150)]">
                {currentScore != null ? `${Math.round(Number(currentScore))}%` : "—"}
              </span>
              <TrendingUp className="size-3.5 text-[oklch(0.78_0.18_150)]"/>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs">
            <span className="opacity-90">
              Question {Math.min(answeredCount + 1, Math.max(totalQuestions, 1))} of {totalQuestions || "—"}
            </span>
            <span className="font-semibold">{pct}%</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full bg-white/15 rounded-full overflow-hidden">
            <div className="h-full bg-[oklch(0.72_0.18_150)] rounded-full transition-all" style={{ width: `${pct}%` }}/>
          </div>
        </div>

        {/* Section card */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 flex items-center gap-3">
          <div className="size-11 rounded-xl bg-[oklch(0.55_0.16_255)] inline-flex items-center justify-center shrink-0">
            <Users className="size-5 text-white"/>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wide opacity-70">Section 1</div>
            <div className="text-sm font-semibold truncate">Questionnaire</div>
            <div className="text-[11px] opacity-75">{answeredCount} / {totalQuestions} Questions</div>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-right shrink-0">
            <div className="text-[10px] uppercase tracking-wide opacity-70 flex items-center gap-1 justify-end">
              <Trophy className="size-3 text-[oklch(0.85_0.15_85)]"/> Section Score
            </div>
            <div className="text-lg font-bold text-[oklch(0.78_0.18_150)]">{computedScore.toFixed(0)}%</div>
          </div>
        </div>
      </section>

      <div className="px-4 sm:px-0 space-y-3">
        {!brandId ? (
          <div className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">Loading employee…</div>
        ) : totalQuestions === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
            No audit questions configured for {employee?.store?.brand?.name ?? "this brand"} yet.
          </div>
        ) : (
          questions!.map((q, idx) => {
            const a = answers[q.id];
            const answered = a && isAnswered(a);
            const isCurrent = !answered && idx === firstUnansweredIdx;
            const label = a ? answerLabel(q, a) : null;
            const max = Number(q.max_score) || computeMaxScore(q.question_type, q.options);
            const earned = answered && a ? Math.round(scoreAnswer(q.question_type, q.options, a)) : 0;

            return (
              <div
                key={q.id}
                className={`rounded-2xl bg-card p-4 shadow-sm transition-colors ${
                  isCurrent ? "border-2 border-[oklch(0.55_0.16_255)]" : "border"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Status dot */}
                  <div className="pt-0.5 shrink-0">
                    {answered ? (
                      <div className="size-6 rounded-full bg-[oklch(0.68_0.16_150)] inline-flex items-center justify-center">
                        <CheckCircle2 className="size-4 text-white"/>
                      </div>
                    ) : (
                      <div className={`size-6 rounded-full border-2 ${isCurrent ? "border-[oklch(0.55_0.16_255)]" : "border-muted-foreground/40"}`}/>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold leading-snug">
                      <span className="mr-1">Q{idx + 1}.</span>
                      {q.question_text}
                      {q.required && <span className="text-destructive ml-1">*</span>}
                    </div>
                  </div>
                  <button type="button" aria-label="Bookmark" className="text-muted-foreground hover:text-foreground shrink-0">
                    <Bookmark className="size-4"/>
                  </button>
                </div>

                {/* Input */}
                <div className="mt-3 pl-9">
                  {a && <QuestionInput q={q} answer={a} onChange={(na) => setA(q.id, na)}/>}
                </div>

                {/* Footer pills */}
                {answered && (label || max > 0) && (
                  <div className="mt-3 pl-9 flex items-center justify-between gap-2">
                    {label ? (
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium bg-[oklch(0.94_0.06_150)] text-[oklch(0.30_0.10_150)] truncate max-w-[60%]">
                        {label}
                      </span>
                    ) : <span/>}
                    {max > 0 && (
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold bg-[oklch(0.94_0.05_255)] text-[oklch(0.35_0.14_255)]">
                          +{earned} {earned === 1 ? "pt" : "pts"}
                        </span>
                        <ChevronRight className="size-4 text-muted-foreground"/>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Submit card */}
        {totalQuestions > 0 && (
          <form
            onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
            className="rounded-2xl border bg-card p-5 space-y-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Computed score</div>
              <div className="text-2xl font-bold text-[oklch(0.68_0.16_150)]">{computedScore.toFixed(1)}</div>
            </div>
            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1.5"/>
            </div>
            <Button
              type="submit"
              disabled={mutation.isPending || !requiredOk}
              className="w-full h-12 rounded-xl bg-[oklch(0.18_0.05_255)] hover:bg-[oklch(0.22_0.06_255)] text-white"
            >
              {mutation.isPending ? "Submitting…" : requiredOk ? "Submit Audit" : "Answer all required questions"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// Per-type inputs (unchanged logic, lightly restyled)
// =====================================================================

function QuestionInput({ q, answer, onChange }: { q: Q; answer: Answer; onChange: (a: Answer) => void }) {
  const t = q.question_type;

  if (t === "yes_no" && answer.kind === "yes_no") {
    return (
      <div className="flex gap-2">
        {(["yes", "no"] as const).map((v) => (
          <Button key={v} type="button" size="sm" variant={answer.value === v ? "default" : "outline"} onClick={() => onChange({ kind: "yes_no", value: v })}>
            {v === "yes" ? "Yes" : "No"}
          </Button>
        ))}
      </div>
    );
  }

  if (t === "single_choice" && answer.kind === "single_choice") {
    const opts = (q.options as ChoiceOption[]) ?? [];
    return (
      <RadioGroup value={answer.index !== null ? String(answer.index) : ""} onValueChange={(v) => onChange({ kind: "single_choice", index: Number(v) })}>
        {opts.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <RadioGroupItem value={String(i)} id={`${q.id}-${i}`}/>
            <label htmlFor={`${q.id}-${i}`} className="text-sm cursor-pointer">{o.label}</label>
          </div>
        ))}
      </RadioGroup>
    );
  }

  if (t === "multi_choice" && answer.kind === "multi_choice") {
    const opts = (q.options as ChoiceOption[]) ?? [];
    const toggle = (i: number) => {
      const set = new Set(answer.indices);
      if (set.has(i)) set.delete(i); else set.add(i);
      onChange({ kind: "multi_choice", indices: Array.from(set).sort() });
    };
    return (
      <div className="space-y-1">
        {opts.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <Checkbox id={`${q.id}-${i}`} checked={answer.indices.includes(i)} onCheckedChange={() => toggle(i)}/>
            <label htmlFor={`${q.id}-${i}`} className="text-sm cursor-pointer">{o.label}</label>
          </div>
        ))}
      </div>
    );
  }

  if ((t === "short_text" || t === "long_text") && answer.kind === "text") {
    return t === "short_text"
      ? <Input value={answer.value} onChange={(e) => onChange({ kind: "text", value: e.target.value })} placeholder="Your answer"/>
      : <Textarea value={answer.value} onChange={(e) => onChange({ kind: "text", value: e.target.value })} rows={3} placeholder="Your answer"/>;
  }

  if ((t === "rating_stars" || t === "rating_number") && answer.kind === "rating") {
    const o = q.options as RatingOptions;
    if (t === "rating_stars") {
      return (
        <div className="flex gap-1">
          {Array.from({ length: o.max }).map((_, i) => {
            const step = i + 1;
            const filled = answer.step !== null && step <= answer.step;
            return (
              <button key={i} type="button" onClick={() => onChange({ kind: "rating", step })} className="p-0.5">
                <Star className={`size-7 ${filled ? "fill-[oklch(0.78_0.16_85)] text-[oklch(0.78_0.16_85)]" : "text-muted-foreground"}`}/>
              </button>
            );
          })}
        </div>
      );
    }
    return (
      <div className="flex gap-1 flex-wrap">
        {Array.from({ length: o.max }).map((_, i) => {
          const step = i + 1;
          const sel = answer.step === step;
          return (
            <button key={i} type="button" onClick={() => onChange({ kind: "rating", step })}
              className={`border rounded-md w-9 h-9 inline-flex items-center justify-center text-sm ${sel ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"}`}>{step}</button>
          );
        })}
      </div>
    );
  }

  if (t === "likert" && answer.kind === "likert") {
    const o = q.options as LikertOptions;
    return (
      <div className="overflow-x-auto">
        <table className="text-sm w-full">
          <thead>
            <tr>
              <th></th>
              {o.scale.map((s, i) => <th key={i} className="font-normal text-xs text-muted-foreground p-1 text-center">{s.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {o.statements.map((st, ri) => (
              <tr key={ri} className="border-t">
                <td className="pr-3 py-2">{st}</td>
                {o.scale.map((_, ci) => (
                  <td key={ci} className="text-center p-1">
                    <input
                      type="radio"
                      name={`${q.id}-${ri}`}
                      checked={answer.perStatement[ri] === ci}
                      onChange={() => onChange({ kind: "likert", perStatement: answer.perStatement.map((v, j) => j === ri ? ci : v) })}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (t === "date" && answer.kind === "date") {
    return <Input type="date" value={answer.value} onChange={(e) => onChange({ kind: "date", value: e.target.value })}/>;
  }

  if (t === "ranking" && answer.kind === "ranking") {
    const opts = (q.options as ChoiceOption[]) ?? [];
    const move = (pos: number, dir: -1 | 1) => {
      const target = pos + dir;
      if (target < 0 || target >= answer.order.length) return;
      const next = [...answer.order];
      [next[pos], next[target]] = [next[target], next[pos]];
      onChange({ kind: "ranking", order: next });
    };
    return (
      <ol className="space-y-1">
        {answer.order.map((optIdx, pos) => (
          <li key={pos} className="flex items-center gap-2 border rounded-md p-2">
            <span className="text-xs text-muted-foreground w-5">{pos + 1}.</span>
            <span className="flex-1 text-sm">{opts[optIdx]?.label}</span>
            <Button type="button" size="icon" variant="ghost" onClick={() => move(pos, -1)} disabled={pos === 0}><ArrowUp className="size-4"/></Button>
            <Button type="button" size="icon" variant="ghost" onClick={() => move(pos, 1)} disabled={pos === answer.order.length - 1}><ArrowDown className="size-4"/></Button>
          </li>
        ))}
      </ol>
    );
  }

  return <p className="text-xs text-muted-foreground">Unsupported question type.</p>;
}
