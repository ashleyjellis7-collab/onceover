import { Gauge } from "@/components/gauge";
import type { ComprehensionResult, StatementOutcome, StatementResult } from "@/engine/comprehension";
import { AUDIENCES, DEPTHS, PURPOSES } from "@/engine/comprehension-options";

const OUTCOME: Record<StatementOutcome, { label: string; tone: "good" | "warn" | "bad" }> = {
  clear: { label: "Likely understood", tone: "good" },
  small_print: { label: "Stated, but only in small print", tone: "warn" },
  at_risk: { label: "Might be missed", tone: "warn" },
  missing: { label: "Not communicated", tone: "bad" },
  contradicted: { label: "Contradicted by the text", tone: "bad" },
  ruled_out: { label: "Clearly ruled out", tone: "good" },
  ambiguous: { label: "Not clearly ruled out", tone: "warn" },
  misleading: { label: "Readers may believe this", tone: "bad" },
};

const TONE = {
  good: "bg-clear/15 text-clear",
  warn: "bg-review/15 text-review",
  bad: "bg-issue/15 text-issue",
};

const GROUPS: { kind: StatementResult["kind"]; title: string; hint: string }[] = [
  { kind: "action", title: "Call to action", hint: "Would the reader know what to do?" },
  { kind: "message", title: "Key messages", hint: "Would the reader take these away?" },
  { kind: "true", title: "Correct statements", hint: "Would the reader believe these?" },
  { kind: "false", title: "Incorrect statements", hint: "Would the reader avoid believing these?" },
];

function heat(d: number) {
  if (d >= 0.6) return "bg-issue/15 border-issue";
  if (d >= 0.35) return "bg-review/15 border-review";
  return "bg-clear/10 border-clear/60";
}

export function ComprehensionReport({ c }: { c: ComprehensionResult }) {
  const input = c.input;
  return (
    <section className="flex flex-col gap-6 rounded-xl border border-line bg-surface p-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">Predicted comprehension</h2>
        <p className="text-sm text-muted">
          {DEPTHS[input.depth].label} · {AUDIENCES[input.audience].label} · {PURPOSES[input.purpose]} ·
          model {c.modelVersion}
        </p>
        <p className="text-sm text-muted">
          This predicts how {AUDIENCES[input.audience].label.toLowerCase()} might read the
          communication. It is not evidence of customer understanding; use it to fix problems
          before testing with real customers.
        </p>
      </header>

      <div className="flex justify-center gap-10">
        <Gauge label="Clarity" value={c.clarity} />
        {c.comprehensionScore !== null && <Gauge label="Comprehension" value={c.comprehensionScore} />}
      </div>

      {GROUPS.map((g) => {
        const items = c.results.filter((r) => r.kind === g.kind);
        if (!items.length) return null;
        return (
          <div key={g.kind} className="flex flex-col gap-2">
            <h3 className="font-semibold">
              {g.title} <span className="text-sm font-normal text-muted">· {g.hint}</span>
            </h3>
            <ul className="flex flex-col gap-2">
              {items.map((r, i) => {
                const o = OUTCOME[r.outcome];
                return (
                  <li key={i} className="rounded-lg border border-line p-3 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium">“{r.statement}”</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE[o.tone]}`}>
                        {o.label}
                      </span>
                    </div>
                    {r.evidence && (
                      <p className="mt-1 border-l-2 border-line pl-2 text-xs italic text-muted">
                        Stated in: “{r.evidence}”
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted">
                      Predicted chance the reader takes this the right way: {Math.round(r.pCorrect * 100)}%
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {c.sections.length > 1 && (
        <details>
          <summary className="cursor-pointer font-semibold">Clarity heatmap</summary>
          <p className="mt-2 text-xs text-muted">
            Each passage shaded by how hard {AUDIENCES[input.audience].label.toLowerCase()} might
            find it: green is clear, amber is worth a look, red is likely to be hard.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {c.sections.map((s, i) => (
              <p key={i} className={`whitespace-pre-wrap rounded-md border-l-4 p-2 text-sm ${heat(s.difficulty)}`}>
                {s.text}
              </p>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
