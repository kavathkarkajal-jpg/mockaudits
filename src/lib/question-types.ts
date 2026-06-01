// Shared types for MS Forms-style questionnaire (client-safe).
import { z } from "zod";

export const QUESTION_TYPES = [
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
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  yes_no: "Yes / No",
  single_choice: "Choice — single select",
  multi_choice: "Choice — multi-select",
  short_text: "Short text",
  long_text: "Long text",
  rating_stars: "Rating — stars",
  rating_number: "Rating — numbers",
  likert: "Likert scale",
  date: "Date",
  ranking: "Ranking",
};

export const ChoiceOption = z.object({
  label: z.string().min(1).max(300),
  weight: z.number().finite(),
});
export type ChoiceOption = z.infer<typeof ChoiceOption>;

export const RatingOptions = z.object({
  max: z.number().int().min(2).max(10),
  weights: z.array(z.number().finite()).min(2).max(10),
});
export type RatingOptions = z.infer<typeof RatingOptions>;

export const LikertOptions = z.object({
  statements: z.array(z.string().min(1).max(300)).min(1).max(20),
  scale: z.array(ChoiceOption).min(2).max(7),
});
export type LikertOptions = z.infer<typeof LikertOptions>;

export const QuestionOptions = z.union([
  z.array(ChoiceOption), // single_choice, multi_choice, ranking
  RatingOptions,         // rating_*
  LikertOptions,         // likert
  z.array(z.any()).length(0), // yes_no/short_text/long_text/date
]);
export type QuestionOptions = z.infer<typeof QuestionOptions>;

// ---------- Max-score computation ----------
export function computeMaxScore(type: QuestionType, options: unknown): number {
  switch (type) {
    case "yes_no":
      return 1;
    case "single_choice": {
      const opts = Array.isArray(options) ? (options as ChoiceOption[]) : [];
      return opts.length ? Math.max(...opts.map((o) => Number(o.weight) || 0)) : 0;
    }
    case "multi_choice": {
      const opts = Array.isArray(options) ? (options as ChoiceOption[]) : [];
      return opts.reduce((s, o) => s + Math.max(0, Number(o.weight) || 0), 0);
    }
    case "rating_stars":
    case "rating_number": {
      const o = options as RatingOptions;
      return o?.weights?.length ? Math.max(...o.weights.map((w) => Number(w) || 0)) : 0;
    }
    case "likert": {
      const o = options as LikertOptions;
      if (!o?.statements?.length || !o?.scale?.length) return 0;
      const perRow = Math.max(...o.scale.map((s) => Number(s.weight) || 0));
      return perRow * o.statements.length;
    }
    case "ranking": {
      const opts = Array.isArray(options) ? (options as ChoiceOption[]) : [];
      // best case = sum of all weights (each slot filled with its declared weight)
      return opts.reduce((s, o) => s + Math.max(0, Number(o.weight) || 0), 0);
    }
    case "short_text":
    case "long_text":
    case "date":
      return 0; // informational only
  }
}

// ---------- Answer scoring (client-side, used by Conduct page) ----------
export type Answer =
  | { kind: "yes_no"; value: "yes" | "no" | null }
  | { kind: "single_choice"; index: number | null }
  | { kind: "multi_choice"; indices: number[] }
  | { kind: "text"; value: string }
  | { kind: "rating"; step: number | null } // 1-based step
  | { kind: "likert"; perStatement: Array<number | null> } // index into scale
  | { kind: "date"; value: string }
  | { kind: "ranking"; order: number[] }; // order[positionIndex] = optionIndex

export function emptyAnswer(type: QuestionType, options: unknown): Answer {
  switch (type) {
    case "yes_no": return { kind: "yes_no", value: null };
    case "single_choice": return { kind: "single_choice", index: null };
    case "multi_choice": return { kind: "multi_choice", indices: [] };
    case "short_text":
    case "long_text": return { kind: "text", value: "" };
    case "rating_stars":
    case "rating_number": return { kind: "rating", step: null };
    case "likert": {
      const o = options as LikertOptions;
      return { kind: "likert", perStatement: (o?.statements ?? []).map(() => null) };
    }
    case "date": return { kind: "date", value: "" };
    case "ranking": {
      const opts = Array.isArray(options) ? (options as ChoiceOption[]) : [];
      return { kind: "ranking", order: opts.map((_, i) => i) };
    }
  }
}

export function isAnswered(a: Answer): boolean {
  switch (a.kind) {
    case "yes_no": return a.value !== null;
    case "single_choice": return a.index !== null;
    case "multi_choice": return a.indices.length > 0;
    case "text": return a.value.trim().length > 0;
    case "rating": return a.step !== null;
    case "likert": return a.perStatement.every((v) => v !== null);
    case "date": return a.value.length > 0;
    case "ranking": return true; // any ordering counts as answered
  }
}

export function scoreAnswer(type: QuestionType, options: unknown, a: Answer): number {
  switch (type) {
    case "yes_no":
      return (a as Extract<Answer, { kind: "yes_no" }>).value === "yes" ? 1 : 0;
    case "single_choice": {
      const opts = options as ChoiceOption[];
      const idx = (a as Extract<Answer, { kind: "single_choice" }>).index;
      return idx == null ? 0 : Number(opts[idx]?.weight) || 0;
    }
    case "multi_choice": {
      const opts = options as ChoiceOption[];
      const idxs = (a as Extract<Answer, { kind: "multi_choice" }>).indices;
      const sum = idxs.reduce((s, i) => s + (Number(opts[i]?.weight) || 0), 0);
      return Math.max(0, sum);
    }
    case "rating_stars":
    case "rating_number": {
      const o = options as RatingOptions;
      const step = (a as Extract<Answer, { kind: "rating" }>).step;
      if (step == null) return 0;
      return Number(o.weights?.[step - 1]) || 0;
    }
    case "likert": {
      const o = options as LikertOptions;
      const per = (a as Extract<Answer, { kind: "likert" }>).perStatement;
      return per.reduce<number>(
        (s, sel) => s + (sel == null ? 0 : Number(o.scale[sel]?.weight) || 0),
        0,
      );
    }
    case "ranking": {
      const opts = options as ChoiceOption[];
      const order = (a as Extract<Answer, { kind: "ranking" }>).order;
      // points if option placed at its "natural" position (index === position)
      // simpler model: weight at slot position i is opts[i].weight, awarded if the
      // option ranked at slot i is the option whose declared weight is highest among remaining.
      // For predictability: award opts[i].weight when order[i] === i (option dragged into its target rank).
      return order.reduce((s, optIdx, pos) => s + (optIdx === pos ? Math.max(0, Number(opts[pos]?.weight) || 0) : 0), 0);
    }
    case "short_text":
    case "long_text":
    case "date":
      return 0;
  }
}
