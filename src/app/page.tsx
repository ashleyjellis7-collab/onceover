import { CheckForm } from "@/components/check-form";
import { Disclaimer } from "@/components/disclaimer";

export default function Home() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          A second pair of eyes before compliance
        </h1>
        <p className="text-lg text-muted">
          Paste a URL or the text of a financial promotion. You get two scores, Finprom and
          Consumer Duty, and every finding names the rule behind it. Free, no sign-up.
        </p>
      </section>
      <CheckForm />
      <Disclaimer />
    </div>
  );
}
