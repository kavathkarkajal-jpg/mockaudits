import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listEmployees, submitAudit } from "@/lib/api/mock-audit.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/conduct/$employeeId")({ component: AuditPage });

function AuditPage() {
  const { employeeId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchEmps = useServerFn(listEmployees);
  const submit = useServerFn(submitAudit);

  const { data: emps } = useQuery({ queryKey: ["employees"], queryFn: () => fetchEmps() });
  const employee = (emps ?? []).find((e) => e.id === employeeId);

  const [score, setScore] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<{ score: number } | null>(null);

  const mutation = useMutation({
    mutationFn: () => submit({ data: { employee_id: employeeId, score: Number(score), notes: notes || undefined } }),
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
        <div className="text-sm font-medium">Questionnaire</div>
        <div className="mt-3 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Questions coming soon. The Admin questionnaire builder will plug in here.
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
        className="rounded-xl border bg-card p-6 space-y-4">
        <div>
          <Label htmlFor="score">Score (0–100)</Label>
          <Input id="score" type="number" min={0} max={100} step="0.1" required
            value={score} onChange={(e) => setScore(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>
        <Button type="submit" disabled={mutation.isPending || !score} className="w-full">
          {mutation.isPending ? "Submitting…" : "Submit Audit"}
        </Button>
      </form>
    </div>
  );
}
