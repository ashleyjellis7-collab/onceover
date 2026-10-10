import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { checkSameAsset, reportWrong } from "@/app/actions";
import { Disclaimer } from "@/components/disclaimer";
import { ComplianceOutcomeForm } from "@/components/compliance-outcome";
import { ComprehensionReport } from "@/components/comprehension-report";
import { Gauge } from "@/components/gauge";
import { getReport } from "@/lib/reports";
import type { AssetReading } from "@/engine/read-asset";
import { getRuleSet, type Band } from "@/rules";

// Reports may be about someone else's page: keep them out of search engines.
export const metadata: Metadata = {
  title: "Report · Onceover",
  robots: { index: false, follow: false },
};

export default function ReportPage({ params, searchParams }: PageProps<"/r/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading report…</p>}>
      <Report params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const ASSET_LABELS: Record<string, string> = {
  social: "Social post or ad",
  webpage: "Web page",
  display_ad: "Display ad",
  email: "Email or letter",
  brochure: "Brochure",
  text: "Pasted text",
};

const BANDS: { band: Band; label: string; className: string }[] = [
  { band: "issue", label: "Issues", className: "text-issue" },
  { band: "review", label: "Review", className: "text-review" },
  { band: "clear", label: "Clear", className: "text-clear" },
];

async function Report({
  params,
  searchParams,
}: {
  params: PageProps<"/r/[id]">["params"];
  searchParams: PageProps<"/r/[id]">["searchParams"];
}) {
  const { id } = await params;
  const { limit } = await searchParams;
  await connection(); // always read the database at request time
  const report = await getReport(id);
  if (!report) notFound();
  const { test, version, findings, comprehension, outcome } = report;
  const rules = new Map(getRuleSet(test.ruleSetVersion)?.rules.map((r) => [r.id, r]));
  const ran = test.createdAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const checks = findings.length;
  // Reports made before the split ran both checkers.
  const showFinprom = test.checker !== "consumer_duty";
  const showDuty = test.checker !== "finprom";
  const other = test.checker === "finprom" ? "consumer_duty" : test.checker === "consumer_duty" ? "finprom" : null;
  const reading = (version?.layout ?? null) as AssetReading | null;
  const title =
    test.checker === "finprom"
      ? "Finprom report"
      : test.checker === "consumer_duty"
        ? "Consumer Duty report"
        : "Report";

  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm text-muted">
          Checked against rule set {test.ruleSetVersion} on {ran} · decision model{" "}
          {test.modelVersion}
        </p>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="break-words font-medium">
          {version?.assetType ? `${ASSET_LABELS[version.assetType]}` : "Asset"}
          {version?.sourceUrl && <> · {version.sourceUrl}</>}
        </p>
        <p className="text-sm text-muted">
          Detected: {test.isPromotion ? "financial promotion" : "not a financial promotion"}
          {test.product && <> · product {test.product.replaceAll("_", " ")}</>}
          {test.channel && <> · channel {test.channel.replaceAll("_", " ")}</>}
        </p>
      </header>

      <section className="flex justify-center gap-10 rounded-xl border border-line bg-surface p-6">
        {showFinprom && <Gauge label="Finprom" value={test.finpromScore} />}
        {showDuty && (
          <Gauge label={comprehension ? "Consumer Duty rules" : "Consumer Duty"} value={test.consumerDutyScore} />
        )}
      </section>
      {comprehension && <ComprehensionReport c={comprehension} />}
      {showFinprom && !test.isPromotion && (
        <p className="text-sm text-muted">
          This doesn&apos;t look like a financial promotion, so the Finprom rules weren&apos;t run.
          If it is one, run the check again and choose the product type.
        </p>
      )}
      {showDuty && test.consumerDutyScore !== null && test.consumerDutyScore >= 90 && (
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

      {version && (
        <details className="rounded-lg border border-line bg-surface p-4">
          <summary className="cursor-pointer font-medium">What we read</summary>
          <p className="mt-2 text-xs text-muted">
            The checks ran on this text. If anything is missing or misread, the findings may be
            wrong; paste the copy and check again.
          </p>
          {reading?.visual_description && (
            <p className="mt-3 text-sm">
              <span className="font-medium">Image:</span> {reading.visual_description}
            </p>
          )}
          {reading ? (
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {reading.elements.map((e, i) => (
                <li key={i} className="border-l-2 border-line pl-3">
                  <span className="text-xs text-muted">
                    {e.role.replaceAll("_", " ")} · {e.size} · {e.position}
                    {e.contrast === "low" && " · low contrast"}
                    {e.in_border && " · in a border"}
                  </span>
                  <span className="block whitespace-pre-wrap">{e.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-sm">
              {version.extractedText}
            </p>
          )}
          {reading && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium">
                Full text checked, including any pasted copy
              </summary>
              <p className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap text-sm">
                {version.extractedText}
              </p>
            </details>
          )}
        </details>
      )}

      {other && (
        <form action={checkSameAsset} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="testId" value={test.id} />
          <input type="hidden" name="checker" value={other} />
          <button className="rounded-lg border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-accent/10">
            Run the {other === "finprom" ? "Finprom" : "Consumer Duty"} check on this asset
          </button>
          {limit && (
            <span className="text-sm text-issue">You&apos;ve used today&apos;s free tests.</span>
          )}
        </form>
      )}

      <ComplianceOutcomeForm testId={test.id} saved={outcome} />

      <footer className="flex flex-col gap-3 border-t border-line pt-6">
        <p className="text-sm">
          {findings.filter((f) => f.band === "issue").length === 0
            ? `No issues found in ${checks} checks.`
            : `${checks} checks ran.`}{" "}
          {test.expiresAt
            ? "This link expires 30 days after the test unless you save it."
            : "You've agreed we can keep this report to improve accuracy."}
        </p>
        <Disclaimer />
      </footer>
    </article>
  );
}
