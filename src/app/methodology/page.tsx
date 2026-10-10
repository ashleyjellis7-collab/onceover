import type { Metadata } from "next";
import { CRITICAL_CAP, WEIGHTS } from "@/engine/score";
import { decisionModel, jevModel } from "@/engine/jev";
import { latestRuleSet, ruleSets, type RuleRecord } from "@/rules";

export const metadata: Metadata = {
  title: "Methodology · Onceover",
  description:
    "Every rule Onceover checks, the exact question asked, severity, thresholds and the score formula.",
};

export default function MethodologyPage() {
  const rs = latestRuleSet;
  const groups: [string, RuleRecord[]][] = [
    ["Financial promotions", rs.rules.filter((r) => r.score === "finprom")],
    ["Consumer Duty", rs.rules.filter((r) => r.score === "consumer_duty")],
  ];
  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Methodology</h1>
        <p className="text-muted">
          Rule set {rs.version}, released {rs.releasedAt}. Nothing is hidden: this page lists every
          check, the question asked and how the score is worked out.
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Score</h2>
        <p className="rounded-md bg-surface p-3 font-mono text-sm">
          Score = max(0, 100 − Σ<sub>Issues</sub> w − ½ Σ<sub>Review</sub> w)
        </p>
        <p className="text-sm">
          Weights: critical {WEIGHTS.critical}, major {WEIGHTS.major}, minor {WEIGHTS.minor}. Any
          critical issue caps the score at {CRITICAL_CAP}. Each check lands in one of three bands:
          Issue, Review or Clear. Low confidence goes to Review; it is never rounded to Clear.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Which model decides what</h2>
        <p className="text-sm">
          Code decides exact-wording rules (fuzzy matching against the prescribed text), reading
          age, and layout. Judgement calls (classifying the asset, each yes/no rule question and
          finding the evidence sentence) are made by{" "}
          {decisionModel() === jevModel ? (
            <>
              TypeSafe&apos;s Jev, pinned to <code>{jevModel.version}</code>. If Jev is unavailable a
              keyword heuristic stands in, and the report says so.
            </>
          ) : (
            <>a keyword heuristic used during development.</>
          )}{" "}
          Images and PDFs are first transcribed by Claude, which records each piece of text with
          its size, position and contrast; it never decides a verdict, and you can see what it read
          on every report. Explanations are written from the rule record and never decide a verdict.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">What it cannot check</h2>
        <p className="text-sm">
          Targeting and distribution, whether an s21 approval exists, whether a quoted rate is
          real, product governance, and non-English content. Accuracy figures will be published
          here once the labelled test set is built.
        </p>
      </section>

      {groups.map(([title, rules]) => (
        <section key={title} className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">{title}</h2>
          {rules.map((r) => (
            <div key={r.id} id={r.id} className="rounded-lg border border-line bg-surface p-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium">{r.title}</h3>
                <span className="text-xs text-muted">
                  {r.severity} · {r.check.type === "noul" ? "model" : "code"}
                </span>
              </div>
              <a href={r.source} className="text-accent underline" target="_blank" rel="noreferrer">
                {r.citation}
              </a>{" "}
              <span className="text-xs text-muted">(source checked {r.sourceVersion})</span>
              {r.check.type === "noul" && <p className="mt-2">Question: {r.check.question}</p>}
              <p className="mt-1 text-xs text-muted">
                Thresholds: Issue ≥ {r.thresholds.issue}, Review ≥ {r.thresholds.review}
                {r.appliesWhen.products && <> · applies to {r.appliesWhen.products.join(", ")}</>}
                {r.appliesWhen.channels && <> · channels {r.appliesWhen.channels.join(", ")}</>}
              </p>
            </div>
          ))}
        </section>
      ))}

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Data handling</h2>
        <p className="text-sm">
          Anonymous reports, including the extracted text, are deleted 30 days after the test.
          Uploaded files themselves are not stored, only the text read from them. Uploads are never
          used to train any model. If you tell us what your compliance team decided and agree that
          we may keep the asset, a person reviews it and it may join our labelled test set, which
          we use to measure and tune accuracy. Reports are unlisted and marked noindex.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Changelog</h2>
        <ul className="text-sm">
          {ruleSets.map((s) => (
            <li key={s.version}>
              <strong>{s.version}</strong> ({s.releasedAt}): {s.changelog}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
