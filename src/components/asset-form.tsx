"use client";

import { startTransition, useActionState, useState } from "react";
import { checkAsset, type CheckState } from "@/app/actions";

type Checker = "finprom" | "consumer_duty";
type Field = { label: string; hint?: string };
type AssetType = {
  id: "social" | "webpage" | "display_ad" | "email" | "brochure" | "text";
  label: string;
  description: string;
  copy?: Field;
  url?: Field;
  file?: Field;
};

const ASSET_TYPES: AssetType[] = [
  {
    id: "social",
    label: "Social post or ad",
    description: "Instagram, TikTok, Facebook, X, LinkedIn",
    copy: { label: "Post copy or caption" },
    file: { label: "Image or screenshot of the post", hint: "Optional if you've pasted the copy." },
    url: {
      label: "Ad Library or post link",
      hint: "Optional. We can't open these links because they need a login, so add the copy or a screenshot too.",
    },
  },
  {
    id: "webpage",
    label: "Web page or article",
    description: "A landing page, blog post or article",
    url: { label: "Page URL", hint: "We read the page's text. For pages that need a login or load slowly, upload a screenshot instead." },
    file: { label: "Or a screenshot of the page" },
  },
  {
    id: "display_ad",
    label: "Display ad or banner",
    description: "A static banner or display image",
    file: { label: "The ad image" },
    copy: { label: "Any copy that isn't in the image", hint: "Optional." },
  },
  {
    id: "email",
    label: "Email or letter",
    description: "Marketing emails, customer letters, scripts",
    copy: { label: "Paste the text" },
    file: { label: "Or upload a screenshot or PDF" },
  },
  {
    id: "brochure",
    label: "Brochure or PDF",
    description: "Leaflets, brochures, key facts documents",
    file: { label: "Upload the PDF or an image" },
  },
  {
    id: "text",
    label: "Just text",
    description: "Paste copy from anywhere",
    copy: { label: "Paste the copy" },
  },
];

const PRODUCTS: [string, string][] = [
  ["", "Detect automatically"],
  ["mainstream_investment", "Mainstream investment"],
  ["crypto", "Cryptoasset"],
  ["nrrs", "Non-readily realisable security"],
  ["p2p", "Peer-to-peer"],
  ["ltaf", "Long-term asset fund"],
  ["consumer_credit", "Consumer credit"],
  ["bnpl", "Buy now, pay later"],
  ["savings", "Savings"],
];

const MAX_BYTES = 4 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/gif,image/webp,application/pdf";

export function AssetForm({ checker }: { checker: Checker }) {
  const [state, action, pending] = useActionState<CheckState, FormData>(checkAsset, {});
  const [typeId, setTypeId] = useState<AssetType["id"] | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const type = ASSET_TYPES.find((t) => t.id === typeId);

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-medium">1. What are you checking?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {ASSET_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTypeId(t.id)}
              aria-pressed={t.id === typeId}
              className={`rounded-lg border p-4 text-left transition ${
                t.id === typeId
                  ? "border-accent bg-accent/10 ring-2 ring-accent/30"
                  : "border-line bg-surface hover:border-accent/60"
              }`}
            >
              <span className="block font-medium">{t.label}</span>
              <span className="block text-sm text-muted">{t.description}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {type && (
        <form
          // Submit through a transition rather than the form action prop, so React
          // doesn't clear what the user entered when the check returns an error.
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            startTransition(() => action(data));
          }}
          className="flex flex-col gap-5"
          key={type.id}
        >
          <p className="font-medium">2. Add the asset</p>
          <input type="hidden" name="checker" value={checker} />
          <input type="hidden" name="assetType" value={type.id} />

          {type.copy && (
            <Labelled field={type.copy} htmlFor="copy">
              <textarea
                id="copy"
                name="copy"
                rows={6}
                className="w-full rounded-lg border border-line bg-surface p-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
            </Labelled>
          )}

          {type.url && (
            <Labelled field={type.url} htmlFor="url">
              <input
                id="url"
                name="url"
                type="url"
                inputMode="url"
                placeholder="https://"
                className="w-full rounded-lg border border-line bg-surface p-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
            </Labelled>
          )}

          {type.file && (
            <Labelled field={type.file} htmlFor="file">
              <input
                id="file"
                name="file"
                type="file"
                accept={ACCEPT}
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  if (f && f.size > MAX_BYTES) {
                    setFileError("That file is over 4MB. Upload a smaller one.");
                    e.currentTarget.value = "";
                  } else setFileError(null);
                }}
                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-4 file:py-2 file:text-white"
              />
              <span className="mt-1 block text-xs text-muted">PNG, JPG, GIF, WebP or PDF, up to 4MB.</span>
              {fileError && <span className="mt-1 block text-sm text-issue">{fileError}</span>}
            </Labelled>
          )}

          {checker === "finprom" && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">
                Product <span className="font-normal text-muted">(optional)</span>
              </span>
              <select
                name="product"
                className="rounded-md border border-line bg-surface px-3 py-2 text-base sm:max-w-sm"
              >
                {PRODUCTS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          )}

          {state.error && (
            <p role="alert" className="rounded-md bg-issue/10 px-3 py-2 text-sm text-issue">
              {state.error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-accent px-6 py-3 font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Checking…" : "Check"}
            </button>
            {pending && (
              <span className="text-sm text-muted">Reading images and PDFs can take up to 30 seconds.</span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function Labelled({
  field,
  htmlFor,
  children,
}: {
  field: Field;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {field.label}
      </label>
      {field.hint && <span className="text-xs text-muted">{field.hint}</span>}
      <div className="mt-1">{children}</div>
    </div>
  );
}
