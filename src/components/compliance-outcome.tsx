import { recordComplianceOutcome } from "@/app/actions";

const OPTIONS = [
  ["approved", "Approved as it is"],
  ["approved_with_changes", "Approved with changes"],
  ["rejected", "Rejected"],
  ["not_reviewed", "Not reviewed yet"],
] as const;

export function ComplianceOutcomeForm({
  testId,
  saved,
}: {
  testId: string;
  saved: { outcome: string; note: string | null; consentToImprove: boolean } | null;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-6">
      <h2 className="text-lg font-semibold">What did compliance decide?</h2>
      <p className="text-sm text-muted">
        Telling us what your compliance team decided helps us measure and improve accuracy. It
        isn&apos;t shared with anyone else.
      </p>
      <form action={recordComplianceOutcome} className="flex flex-col gap-3">
        <input type="hidden" name="testId" value={testId} />
        <div className="grid gap-2 sm:grid-cols-2">
          {OPTIONS.map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="outcome"
                value={value}
                required
                defaultChecked={saved?.outcome === value}
              />
              {label}
            </label>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            What did they change or object to? <span className="font-normal text-muted">(optional)</span>
          </span>
          <textarea
            name="note"
            rows={3}
            defaultValue={saved?.note ?? ""}
            className="rounded-lg border border-line bg-background p-2 text-base"
          />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="consent" defaultChecked={saved?.consentToImprove ?? false} className="mt-1" />
          <span>
            Onceover may keep this asset and decision to improve accuracy. It will be reviewed by
            a person and used only in our test set, never to train a model. Without this, the
            report is deleted after 30 days as usual.
          </span>
        </label>
        <div className="flex items-center gap-3">
          <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            Save
          </button>
          {saved && <span className="text-sm text-clear">Saved. Thank you.</span>}
        </div>
      </form>
    </section>
  );
}
