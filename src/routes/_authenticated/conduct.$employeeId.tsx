import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  listEmployees,
  listQuestionsForBrand,
  submitAudit,
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
import { Star, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/conduct/$employeeId")({ component: AuditPage });

type Q = {
  id: string;
  question_text: string;
  question_type: QuestionType;
  options: unknown;
  required: boolean;
  max_score: number;
};

function AuditPage() {
  const { employeeId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchEmps = useServerFn(listEmployees);
  const fetchQuestions = useServerFn(listQuestionsForBrand);
  const submit = useServerFn(submitAudit);

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
  const [result, setResult] = useState<{ score: number } | null>(null);

  // Initialize answers when questions load / change
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

  const computedScore = useMemo(() => {
    if (!questions || questions.length === 0) return 0;
    const scored = questions.filter((q) => {
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
  }, [answers, questions]);

  const mutation = useMutation({
    mutationFn: () =>
      submit({
        data: {
          employee_id: employeeId,
          score: Number(computedScore.toFixed(1)),
          notes: notes || undefined,
        },
      }),
    onSuccess: (r) => {
      setResult({ score: Number(r.score) });
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Audit submitted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (result && employee) {
    return (
      <div className="max-w-md mx-auto rounded-2xl bg-card p-8 text-center shadow border">
        <div className="text-sm text-muted-foreground">Audit complete for</div>
        <h2 className="text-xl font-semibold">{employee.name}</h2>
        <div className="mt-6 text-5xl font-bold text-[oklch(0.55_0.16_255)]">{result.score.toFixed(1)}</div>
        <div className="text-xs text-muted-foreground mt-1">Score (out of 100)</div>
        <div className="mt-6 flex gap-2 justify-center">
          <Button asChild variant="outline"><Link to="/conduct">Back to list</Link></Button>
          <Button onClick={() => navigate({ to: "/dashboard" })}>View Dashboard</Button>
        </div>
      </div>
    );
  }

  const setA = (id: string, a: Answer) => setAnswers((p) => ({ ...p, [id]: a }));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link to="/conduct" className="text-xs text-muted-foreground hover:underline">← All employees</Link>
        <h1 className="text-2xl font-semibold mt-1">{employee?.name ?? "Employee"}</h1>
        <p className="text-sm text-muted-foreground">
          {employee?.store?.brand?.name} · {employee?.store?.name} · {employee?.employee_code}
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-baseline justify-between">
          <div className="text-sm font-medium">Questionnaire</div>
          {totalQuestions > 0 && (
            <div className="text-xs text-muted-foreground">{answeredCount} / {totalQuestions} answered</div>
          )}
        </div>

        {!brandId ? (
          <div className="mt-3 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Loading employee…</div>
        ) : totalQuestions === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No audit questions configured for {employee?.store?.brand?.name ?? "this brand"} yet.
          </div>
        ) : (
          <ol className="mt-4 space-y-3">
            {questions!.map((q, idx) => (
              <li key={q.id} className="rounded-lg border p-4">
                <div className="flex items-start gap-3">
                  <span className="text-xs text-muted-foreground mt-1 w-6 shrink-0">{idx + 1}.</span>
                  <div className="flex-1 text-sm font-medium">
                    {q.question_text}
                    {q.required && <span className="text-destructive ml-1">*</span>}
                  </div>
                </div>
                <div className="mt-3 pl-9">
                  {answers[q.id] && <QuestionInput q={q} answer={answers[q.id]} onChange={(a) => setA(q.id, a)}/>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
        className="rounded-xl border bg-card p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">Computed score</div>
          <div className="text-2xl font-semibold">{computedScore.toFixed(1)}</div>
        </div>
        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>
        <Button type="submit" disabled={mutation.isPending || !requiredOk} className="w-full">
          {mutation.isPending ? "Submitting…" : requiredOk ? "Submit Audit" : "Answer all required questions to submit"}
        </Button>
      </form>
    </div>
  );
}

// =====================================================================
// Per-type inputs
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
