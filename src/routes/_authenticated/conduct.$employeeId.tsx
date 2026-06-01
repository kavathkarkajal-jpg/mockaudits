import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  listEmployees,
  listQuestionsForBrand,
  submitAudit,
} from "@/lib/api/mock-audit.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/conduct/$employeeId")({ component: AuditPage });

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
    queryFn: () => fetchQuestions({ data: { brand_id: brandId! } }),
    enabled: !!brandId,
  });

  const [answers, setAnswers] = useState<Record<string, "yes" | "no">>({});
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<{ score: number } | null>(null);

  const totalQuestions = questions?.length ?? 0;
  const answeredCount = useMemo(
    () => (questions ?? []).filter((q) => answers[q.id]).length,
    [answers, questions],
  );
  const yesCount = useMemo(
    () => (questions ?? []).filter((q) => answers[q.id] === "yes").length,
    [answers, questions],
  );
  const computedScore = totalQuestions ? (yesCount / totalQuestions) * 100 : 0;
  const allAnswered = totalQuestions > 0 && answeredCount === totalQuestions;

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
          <div className="mt-3 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Loading employee…
          </div>
        ) : totalQuestions === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No audit questions configured for {employee?.store?.brand?.name ?? "this brand"} yet.
            Ask an admin to add some in the Admin panel.
          </div>
        ) : (
          <ol className="mt-4 space-y-3">
            {questions!.map((q, idx) => (
              <li key={q.id} className="rounded-lg border p-4">
                <div className="flex items-start gap-3">
                  <span className="text-xs text-muted-foreground mt-1 w-6 shrink-0">{idx + 1}.</span>
                  <div className="flex-1 text-sm">{q.question_text}</div>
                </div>
                <div className="mt-3 flex gap-2 pl-9">
                  {(["yes", "no"] as const).map((v) => (
                    <Button
                      key={v}
                      type="button"
                      size="sm"
                      variant={answers[q.id] === v ? "default" : "outline"}
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: v }))}
                    >
                      {v === "yes" ? "Yes" : "No"}
                    </Button>
                  ))}
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
        <Button
          type="submit"
          disabled={mutation.isPending || !allAnswered}
          className="w-full"
        >
          {mutation.isPending ? "Submitting…" : allAnswered ? "Submit Audit" : "Answer all questions to submit"}
        </Button>
      </form>
    </div>
  );
}
