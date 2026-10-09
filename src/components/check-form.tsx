"use client";

import { useActionState } from "react";
import { checkAsset, type CheckState } from "@/app/actions";

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

const CHANNELS: [string, string][] = [
  ["", "Detect automatically"],
  ["website", "Website"],
  ["social", "Social post"],
  ["display_ad", "Display ad"],
  ["email", "Email"],
  ["print", "Print"],
];

export function CheckForm() {
  const [state, action, pending] = useActionState<CheckState, FormData>(checkAsset, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <label htmlFor="input" className="sr-only">
        URL or text to check
      </label>
      <textarea
        id="input"
        name="input"
        required
        rows={7}
        placeholder="Paste a URL (https://…) or the text of your promotion"
        className="w-full rounded-lg border border-line bg-surface p-4 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select name="product" label="Product" options={PRODUCTS} />
        <Select name="channel" label="Channel" options={CHANNELS} />
      </div>
      {state.error && (
        <p role="alert" className="rounded-md bg-issue/10 px-3 py-2 text-sm text-issue">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-accent px-6 py-3 font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Checking…" : "Check"}
      </button>
    </form>
  );
}

function Select({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: [string, string][];
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-muted">
      {label} <span className="text-xs">(optional)</span>
      <select
        name={name}
        className="rounded-md border border-line bg-surface px-3 py-2 text-base text-foreground"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
