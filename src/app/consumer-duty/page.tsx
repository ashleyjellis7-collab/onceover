import type { Metadata } from "next";
import { AssetForm } from "@/components/asset-form";
import { Disclaimer } from "@/components/disclaimer";

export const metadata: Metadata = {
  title: "Consumer Duty checker · Onceover",
  description:
    "Check whether customers, including those in vulnerable circumstances, would understand an asset: reading age, jargon, pressure, costs and support.",
};

export default function ConsumerDutyPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Consumer Duty checker</h1>
        <p className="text-muted">
          Checks how an asset lands with customers, including those in vulnerable circumstances:
          reading age, jargon, false urgency, costs in pounds and a clear route to help. It&apos;s a
          lint to run before customer testing, not a substitute for it.
        </p>
      </header>
      <AssetForm checker="consumer_duty" />
      <Disclaimer />
    </div>
  );
}
