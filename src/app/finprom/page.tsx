import type { Metadata } from "next";
import { AssetForm } from "@/components/asset-form";
import { Disclaimer } from "@/components/disclaimer";

export const metadata: Metadata = {
  title: "Finprom checker · Onceover",
  description:
    "Pre-check a financial promotion against FCA rules: COBS 4, the high-risk investment rules in COBS 4.12A, CONC 3 and FG24/1.",
};

export default function FinpromPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Finprom checker</h1>
        <p className="text-muted">
          Checks a financial promotion against the FCA&apos;s promotion rules: fair, clear and not
          misleading, performance claims, high-risk investment warnings, consumer credit and social
          media. Every finding names the rule behind it.
        </p>
      </header>
      <AssetForm checker="finprom" />
      <Disclaimer />
    </div>
  );
}
