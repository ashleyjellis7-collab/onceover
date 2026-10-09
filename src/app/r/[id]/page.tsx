import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { reportWrong } from "@/app/actions";
import { Disclaimer } from "@/components/disclaimer";
import { Gauge } from "@/components/gauge";
import { getReport } from "@/lib/reports";
import { getRuleSet, type Band } from "@/rules";

// Reports may be about someone else's page: keep them out of search engines.
export const metadata: Metadata = {
  title: "Report · Onceover",
  robots: { index: false, follow: false },
};

export default function ReportPage({ params }: PageProps<"/r/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading report…</p>}>
      <Report params={params} />
    </Suspense>
  );
}

const BANDS: { band: Band; label: string; className: string }[] = [
  { band: "issue", label: "Issues", className: "text-issue" },
  { band: "review", label: "Review", className: "text-review" },
  { band: "clear", label: "Clear", className: "text-clear" },
];

async function Report({ params }: { params: PageProps<"/r/[id]">["params"] }) {
  const { id } = await params;
  await connection(); // always read the database at request time
  const report = await getReport(id);
  if (!report) notFound();
  const { test, version, findings } = report;
  const rules = new Map(getRuleSet(test.ruleSetVersion)?.rules.map((r) => [r.id, r]));
  const ran = test.createdAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const checks = findings.length;

  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm text-muted">
          Checked against rule set {test.ruleSetVersion} on {ran} · decision model{" "}
          {test.modelVersion}
        </p>
        <h1 className="break-words text-2xl font-semibold">
          {version?.sourceUrl ?? "Pasted text"}
        </h1>
        <p className="text-sm text-muted">
          Detected: {test.isPromotion ? "financial promotion" : "not a financial promotion"}
          {test.product && <> · product {test.product.replaceAll("_", " ")}</>}
          {test.channel && <> · channel {test.channel.replaceAll("_", " ")}</>}
        </p>
      </header>

      <section className="flex justify-center gap-10 rounded-xl border border-line bg-surface p-6">
        <Gauge label="Finprom" value={test.finpromScore} />
        <Gauge label="Consumer Duty" value={test.consumerDutyScore} />
      </section>
      {!test.isPromotion && (
        <p className="text-sm text-muted">
          This doesn&apos;t look like a financial promotion, so only the Consumer Duty check ran. If
          it is one, go back and choose the product type.
        </p>
      )}
      {test.consumerDutyScore >= 90 && (
        <p className="text-sm text-muted">
          A high Consumer Duty score is a lint result, not evidence of good outcomes. It does not
          replace testing with real customers.
        </p>
      )}

      {BANDS.map(({ band, label, className }) => {
        const items = findings.filter((f) => f.band === band);
        if (!items.length) return null;
        const list = (
          <ul className="flex flex-col gap-3">
            {items.map((f) => {
              const rule = rules.get(f.ruleId);
              return (
                <li key={f.id} className="rounded-lg border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-medium">{rule?.title ?? f.ruleId}</h3>
                    <span className="text-xs text-muted">
                      {f.severity} · {f.score === "finprom" ? "Finprom" : "Consumer Duty"} ·
                      confidence {Math.round(Math.max(f.probability, 1 - f.probability) * 100)}% ·{" "}
                      {f.decidedBy === "code" ? "code check" : "model check"}
                    </span>
                  </div>
                  {rule && (
                    <a href={rule.source} className="text-sm text-accent underline" target="_blank" rel="noreferrer">
                      {rule.citation}
                    </a>
                  )}
                  <p className="mt-2 text-sm">{f.explanation}</p>
                  {f.evidence && (
                    <blockquote className="mt-2 border-l-2 border-line pl-3 text-sm italic text-muted">
                      “{f.evidence}”
                    </blockquote>
                  )}
                  {band !== "clear" && f.suggestion && (
                    <p className="mt-2 text-sm">
                      <span className="font-medium">Suggestion:</span> {f.suggestion}
                    </p>
                  )}
                  {band !== "clear" && (
                    <form action={reportWrong} className="mt-2">
                      <input type="hidden" name="testId" value={test.id} />
                      <input type="hidden" name="findingId" value={f.id} />
                      <button className="text-xs text-muted underline" disabled={f.flaggedWrong}>
                        {f.flaggedWrong ? "Thanks, sent for review" : "This finding looks wrong"}
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        );
        return (
          <section key={band} className="flex flex-col gap-3">
            {band === "clear" ? (
              <details>
                <summary className={`cursor-pointer text-lg font-semibold ${className}`}>
                  {label} ({items.length})
                </summary>
                <div className="mt-3">{list}</div>
              </details>
            ) : (
              <>
                <h2 className={`text-lg font-semibold ${className}`}>
                  {label} ({items.length})
                </h2>
                {list}
              </>
            )}
          </section>
        );
      })}

      <footer className="flex flex-col gap-3 border-t border-line pt-6">
        <p className="text-sm">
          {findings.filter((f) => f.band === "issue").length === 0
            ? `No issues found in ${checks} checks.`
            : `${checks} checks ran.`}{" "}
          This link expires 30 days after the test unless you save it.
        </p>
        <Disclaimer />
      </footer>
    </article>
  );
}
