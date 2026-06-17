import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListQuestions, upsertQuestion, deleteQuestion, reorderQuestions,
  listSections, upsertSection, deleteSection,
} from "@/lib/api/mock-audit.functions";
import {
  type QuestionType, QUESTION_TYPES, QUESTION_TYPE_LABELS,
  type ChoiceOption, type RatingOptions, type LikertOptions,
  computeMaxScore,
} from "@/lib/question-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Plus, Star, Trash2, X } from "lucide-react";

type AdminQuestion = {
  id: string;
  brand_id: string;
  section_id: string | null;
  question_text: string;
  question_type: QuestionType;
  display_order: number;
  options: unknown;
  required: boolean;
  max_score: number;
};

type Section = { id: string; brand_id: string; name: string; display_order: number };

const UNSECTIONED = "__none__";

const DEFAULT_OPTIONS: Record<QuestionType, unknown> = {
  yes_no: [],
  single_choice: [{ label: "Option 1", weight: 1 }, { label: "Option 2", weight: 0 }] as ChoiceOption[],
  multi_choice: [{ label: "Option 1", weight: 1 }, { label: "Option 2", weight: 1 }] as ChoiceOption[],
  short_text: [],
  long_text: [],
  rating_stars: { max: 5, weights: [1, 2, 3, 4, 5] } as RatingOptions,
  rating_number: { max: 10, weights: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } as RatingOptions,
  likert: {
    statements: ["Statement 1"],
    scale: [
      { label: "Strongly disagree", weight: 0 },
      { label: "Disagree", weight: 1 },
      { label: "Neutral", weight: 2 },
      { label: "Agree", weight: 3 },
      { label: "Strongly agree", weight: 4 },
    ],
  } as LikertOptions,
  date: [],
  ranking: [
    { label: "Item 1", weight: 3 },
    { label: "Item 2", weight: 2 },
    { label: "Item 3", weight: 1 },
  ] as ChoiceOption[],
};

export function QuestionsTab({ brands }: { brands: Array<{ id: string; name: string }> }) {
  const qc = useQueryClient();
  const fetchAll = useServerFn(adminListQuestions);
  const save = useServerFn(upsertQuestion);
  const del = useServerFn(deleteQuestion);
  const reorder = useServerFn(reorderQuestions);
  const fetchSections = useServerFn(listSections);
  const saveSection = useServerFn(upsertSection);
  const delSection = useServerFn(deleteSection);

  const [brandId, setBrandId] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [type, setType] = useState<QuestionType>("yes_no");
  const [options, setOptions] = useState<unknown>(DEFAULT_OPTIONS.yes_no);
  const [required, setRequired] = useState(false);
  const [sectionId, setSectionId] = useState<string>(UNSECTIONED);
  const [newSectionName, setNewSectionName] = useState("");

  const { data: all } = useQuery({
    queryKey: ["admin-questions"],
    queryFn: () => fetchAll() as Promise<AdminQuestion[]>,
  });

  const { data: allSections } = useQuery({
    queryKey: ["admin-sections"],
    queryFn: () => fetchSections() as Promise<Section[]>,
  });

  const sections = useMemo(
    () =>
      (allSections ?? [])
        .filter((s) => s.brand_id === brandId)
        .sort((a, b) => a.display_order - b.display_order),
    [allSections, brandId],
  );

  const list = useMemo(
    () =>
      (all ?? [])
        .filter((q) => q.brand_id === brandId)
        .sort((a, b) => a.display_order - b.display_order),
    [all, brandId],
  );

  const grouped = useMemo(() => {
    const groups: Array<{ key: string; name: string; items: AdminQuestion[] }> = [];
    for (const s of sections) groups.push({ key: s.id, name: s.name, items: [] });
    groups.push({ key: UNSECTIONED, name: "Unsectioned", items: [] });
    const byKey = new Map(groups.map((g) => [g.key, g] as const));
    for (const q of list) {
      const k = q.section_id ?? UNSECTIONED;
      (byKey.get(k) ?? byKey.get(UNSECTIONED)!).items.push(q);
    }
    return groups.filter((g) => g.items.length > 0 || g.key !== UNSECTIONED);
  }, [sections, list]);

  const invBrand = () => {
    qc.invalidateQueries({ queryKey: ["admin-questions"] });
    qc.invalidateQueries({ queryKey: ["admin-sections"] });
    qc.invalidateQueries({ queryKey: ["questions", brandId] });
    qc.invalidateQueries({ queryKey: ["sections", brandId] });
  };

  const resetForm = () => {
    setEditingId(null);
    setText("");
    setType("yes_no");
    setOptions(DEFAULT_OPTIONS.yes_no);
    setRequired(false);
    setSectionId(UNSECTIONED);
  };

  const startEdit = (q: AdminQuestion) => {
    setEditingId(q.id);
    setText(q.question_text);
    setType(q.question_type);
    setOptions(q.options ?? DEFAULT_OPTIONS[q.question_type]);
    setRequired(!!q.required);
    setSectionId(q.section_id ?? UNSECTIONED);
  };

  const changeType = (t: QuestionType) => {
    setType(t);
    setOptions(DEFAULT_OPTIONS[t]);
  };

  const maxScore = useMemo(() => computeMaxScore(type, options), [type, options]);

  const m = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: editingId ?? undefined,
          brand_id: brandId,
          section_id: sectionId === UNSECTIONED ? null : sectionId,
          question_text: text,
          question_type: type,
          options,
          required,
          max_score: maxScore,
        },
      }),
    onSuccess: () => {
      toast.success(editingId ? "Question updated" : "Question added");
      resetForm();
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

  const addSectionMut = useMutation({
    mutationFn: (name: string) => saveSection({ data: { brand_id: brandId, name } }),
    onSuccess: () => { toast.success("Section added"); setNewSectionName(""); invBrand(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delSectionMut = useMutation({
    mutationFn: (id: string) => delSection({ data: { id } }),
    onSuccess: () => { toast.success("Section deleted"); invBrand(); },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => { resetForm(); }, [brandId]);

  return (
    <div className="space-y-4 mt-4">
      <div className="rounded-xl border bg-card p-4">
        <Label>Brand</Label>
        <Select value={brandId} onValueChange={setBrandId}>
          <SelectTrigger className="max-w-xs"><SelectValue placeholder="Select a brand"/></SelectTrigger>
          <SelectContent>
            {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {brandId && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="text-sm font-medium">Sections</div>
          <div className="flex flex-wrap gap-2">
            {sections.length === 0 && (
              <div className="text-xs text-muted-foreground">No sections yet — questions appear under "Unsectioned".</div>
            )}
            {sections.map((s) => {
              const count = list.filter((q) => q.section_id === s.id).length;
              return (
                <div key={s.id} className="flex items-center gap-1 rounded-md border bg-muted/30 pl-2 pr-1 py-0.5 text-sm">
                  <span>{s.name}</span>
                  <span className="text-xs text-muted-foreground">({count})</span>
                  <Button type="button" size="icon" variant="ghost" className="size-6"
                    onClick={() => {
                      const next = prompt("Rename section", s.name);
                      if (next && next.trim() && next.trim() !== s.name) {
                        renameSectionMut.mutate({ id: s.id, name: next.trim() });
                      }
                    }}>
                    <Pencil className="size-3"/>
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="size-6"
                    disabled={count > 0}
                    title={count > 0 ? "Move or delete its questions first" : "Delete section"}
                    onClick={() => { if (confirm(`Delete section "${s.name}"?`)) delSectionMut.mutate(s.id); }}>
                    <X className="size-3"/>
                  </Button>
                </div>
              );
            })}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); if (newSectionName.trim()) addSectionMut.mutate(newSectionName.trim()); }}
          >
            <Input
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              placeholder="New section name (e.g. Operations)"
              maxLength={120}
              className="max-w-xs"
            />
            <Button type="submit" size="sm" disabled={addSectionMut.isPending || !newSectionName.trim()}>
              <Plus className="size-4 mr-1"/>Add section
            </Button>
          </form>
        </div>
      )}

      {brandId && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          {/* Question list grouped by section */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="p-3 border-b flex items-center justify-between">
              <div className="text-sm font-medium">Questions</div>
              <Button size="sm" variant="ghost" onClick={resetForm}><Plus className="size-4 mr-1"/>New</Button>
            </div>
            {list.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No questions yet.</div>
            ) : (
              <div className="divide-y">
                {grouped.map((g) => (
                  <div key={g.key}>
                    <div className="px-3 py-2 bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {g.name}
                    </div>
                    <ol className="divide-y">
                      {g.items.map((q) => {
                        const idx = list.indexOf(q);
                        return (
                          <li key={q.id} className={`flex items-start gap-2 p-3 ${editingId === q.id ? "bg-muted/50" : ""}`}>
                            <div className="text-xs text-muted-foreground w-6 pt-2">{idx + 1}.</div>
                            <div className="flex-1 pt-1">
                              <div className="text-sm">{q.question_text}{q.required && <span className="text-destructive ml-1">*</span>}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {QUESTION_TYPE_LABELS[q.question_type]} · max {Number(q.max_score)}
                              </div>
                            </div>
                            <div className="flex items-center">
                              <Button size="icon" variant="ghost" disabled={idx === 0 || moveMut.isPending} onClick={() => move(idx, -1)}><ArrowUp className="size-4"/></Button>
                              <Button size="icon" variant="ghost" disabled={idx === list.length - 1 || moveMut.isPending} onClick={() => move(idx, 1)}><ArrowDown className="size-4"/></Button>
                              <Button size="icon" variant="ghost" onClick={() => startEdit(q)}><Pencil className="size-4"/></Button>
                              <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this question?")) d.mutate(q.id); }}><Trash2 className="size-4"/></Button>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Editor */}
          <form
            onSubmit={(e) => { e.preventDefault(); if (text.trim()) m.mutate(); }}
            className="rounded-xl border bg-card p-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">{editingId ? "Edit question" : "New question"}</div>
              <div className="text-xs text-muted-foreground">Max score: <span className="font-mono">{maxScore}</span></div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
              <div>
                <Label htmlFor="qtext">Question</Label>
                <Textarea id="qtext" value={text} onChange={(e) => setText(e.target.value)} rows={2} required maxLength={1000}/>
              </div>
              <div>
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => changeType(v as QuestionType)}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {QUESTION_TYPES.map((t) => <SelectItem key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Section</Label>
              <Select value={sectionId} onValueChange={setSectionId}>
                <SelectTrigger className="max-w-xs"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSECTIONED}>Unsectioned</SelectItem>
                  {sections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Switch id="req" checked={required} onCheckedChange={setRequired}/>
              <Label htmlFor="req" className="cursor-pointer">Required</Label>
            </div>

            <OptionsEditor type={type} options={options} setOptions={setOptions}/>

            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Auditor preview</div>
              <QuestionPreview type={type} options={options} text={text || "Untitled question"} required={required}/>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={m.isPending || !text.trim()}>
                {editingId ? "Save changes" : "Add question"}
              </Button>
              {editingId && <Button type="button" variant="ghost" onClick={resetForm}>Cancel</Button>}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Per-type editors
// =====================================================================

function OptionsEditor({ type, options, setOptions }: { type: QuestionType; options: unknown; setOptions: (o: unknown) => void }) {
  if (type === "single_choice" || type === "multi_choice" || type === "ranking") {
    const opts = (Array.isArray(options) ? options : []) as ChoiceOption[];
    const hint = type === "ranking" ? "Drag-rank target; weight = points if placed at this slot." : "Weight = points if this option is selected.";
    return (
      <div className="space-y-2">
        <Label>Options</Label>
        <div className="space-y-2">
          {opts.map((o, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input value={o.label} onChange={(e) => setOptions(opts.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Option label"/>
              <Input type="number" step="0.5" className="w-24" value={o.weight} onChange={(e) => setOptions(opts.map((x, j) => j === i ? { ...x, weight: Number(e.target.value) } : x))}/>
              <Button type="button" size="icon" variant="ghost" onClick={() => setOptions(opts.filter((_, j) => j !== i))}><X className="size-4"/></Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setOptions([...opts, { label: `Option ${opts.length + 1}`, weight: 0 }])}>
          <Plus className="size-4 mr-1"/>Add option
        </Button>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    );
  }
  if (type === "rating_stars" || type === "rating_number") {
    const o = (options as RatingOptions) ?? { max: 5, weights: [1, 2, 3, 4, 5] };
    const setMax = (max: number) => {
      const weights = Array.from({ length: max }, (_, i) => o.weights?.[i] ?? i + 1);
      setOptions({ max, weights });
    };
    return (
      <div className="space-y-2">
        <div className="flex items-end gap-3">
          <div>
            <Label>Scale max</Label>
            <Input type="number" min={2} max={10} value={o.max} onChange={(e) => setMax(Math.min(10, Math.max(2, Number(e.target.value) || 2)))} className="w-24"/>
          </div>
        </div>
        <Label>Weight per step</Label>
        <div className="flex gap-2 flex-wrap">
          {o.weights.map((w, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground w-4 text-right">{i + 1}</span>
              <Input type="number" step="0.5" className="w-20" value={w} onChange={(e) => setOptions({ ...o, weights: o.weights.map((x, j) => j === i ? Number(e.target.value) : x) })}/>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (type === "likert") {
    const o = (options as LikertOptions) ?? { statements: [""], scale: [] };
    return (
      <div className="space-y-3">
        <div>
          <Label>Statements (rows)</Label>
          <div className="space-y-2 mt-1">
            {o.statements.map((s, i) => (
              <div key={i} className="flex gap-2">
                <Input value={s} onChange={(e) => setOptions({ ...o, statements: o.statements.map((x, j) => j === i ? e.target.value : x) })}/>
                <Button type="button" size="icon" variant="ghost" onClick={() => setOptions({ ...o, statements: o.statements.filter((_, j) => j !== i) })}><X className="size-4"/></Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setOptions({ ...o, statements: [...o.statements, `Statement ${o.statements.length + 1}`] })}>
            <Plus className="size-4 mr-1"/>Add statement
          </Button>
        </div>
        <div>
          <Label>Scale (columns)</Label>
          <div className="space-y-2 mt-1">
            {o.scale.map((s, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input value={s.label} onChange={(e) => setOptions({ ...o, scale: o.scale.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })}/>
                <Input type="number" step="0.5" className="w-24" value={s.weight} onChange={(e) => setOptions({ ...o, scale: o.scale.map((x, j) => j === i ? { ...x, weight: Number(e.target.value) } : x) })}/>
                <Button type="button" size="icon" variant="ghost" onClick={() => setOptions({ ...o, scale: o.scale.filter((_, j) => j !== i) })}><X className="size-4"/></Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setOptions({ ...o, scale: [...o.scale, { label: `Level ${o.scale.length + 1}`, weight: o.scale.length }] })}>
            <Plus className="size-4 mr-1"/>Add scale column
          </Button>
        </div>
      </div>
    );
  }
  if (type === "yes_no") {
    return <p className="text-xs text-muted-foreground">Yes = 1 point, No = 0 points (fixed).</p>;
  }
  return <p className="text-xs text-muted-foreground">No configuration needed — this question type is informational only.</p>;
}

// =====================================================================
// Live preview (read-only render of how the auditor will see it)
// =====================================================================

function QuestionPreview({ type, options, text, required }: { type: QuestionType; options: unknown; text: string; required: boolean }) {
  return (
    <div>
      <div className="text-sm font-medium">{text}{required && <span className="text-destructive ml-1">*</span>}</div>
      <div className="mt-2">
        {type === "yes_no" && (
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline">Yes</Button>
            <Button type="button" size="sm" variant="outline">No</Button>
          </div>
        )}
        {type === "single_choice" && (
          <RadioGroup>
            {((options as ChoiceOption[]) ?? []).map((o, i) => (
              <div key={i} className="flex items-center gap-2"><RadioGroupItem value={String(i)} id={`p${i}`}/><label htmlFor={`p${i}`} className="text-sm">{o.label}</label></div>
            ))}
          </RadioGroup>
        )}
        {type === "multi_choice" && (
          <div className="space-y-1">
            {((options as ChoiceOption[]) ?? []).map((o, i) => (
              <div key={i} className="flex items-center gap-2"><Checkbox id={`mp${i}`}/><label htmlFor={`mp${i}`} className="text-sm">{o.label}</label></div>
            ))}
          </div>
        )}
        {type === "short_text" && <Input disabled placeholder="Short answer"/>}
        {type === "long_text" && <Textarea disabled placeholder="Long answer" rows={3}/>}
        {(type === "rating_stars") && (
          <div className="flex gap-1">
            {Array.from({ length: (options as RatingOptions)?.max ?? 5 }).map((_, i) => (
              <Star key={i} className="size-6 text-muted-foreground"/>
            ))}
          </div>
        )}
        {(type === "rating_number") && (
          <div className="flex gap-1 flex-wrap">
            {Array.from({ length: (options as RatingOptions)?.max ?? 5 }).map((_, i) => (
              <span key={i} className="border rounded-md w-9 h-9 inline-flex items-center justify-center text-sm">{i + 1}</span>
            ))}
          </div>
        )}
        {type === "likert" && (() => {
          const o = options as LikertOptions;
          return (
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr><th></th>{o?.scale?.map((s, i) => <th key={i} className="font-normal text-muted-foreground p-1">{s.label}</th>)}</tr>
                </thead>
                <tbody>
                  {o?.statements?.map((st, ri) => (
                    <tr key={ri}><td className="pr-2 py-1">{st}</td>{o.scale.map((_, ci) => <td key={ci} className="text-center p-1"><input type="radio" disabled/></td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
        {type === "date" && <Input type="date" disabled/>}
        {type === "ranking" && (
          <ol className="text-sm list-decimal pl-5">
            {((options as ChoiceOption[]) ?? []).map((o, i) => <li key={i}>{o.label}</li>)}
          </ol>
        )}
      </div>
    </div>
  );
}
