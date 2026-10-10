import Link from "next/link";
import { Disclaimer } from "@/components/disclaimer";

const CHECKERS = [
  {
    href: "/finprom",
    title: "Finprom checker",
    body: "Is this financial promotion fair, clear and not misleading? Checks risk warnings, incentives, performance claims, credit disclosures and social media rules.",
  },
  {
    href: "/consumer-duty",
    title: "Consumer Duty checker",
    body: "Would customers, including those in vulnerable circumstances, understand it? Checks reading age, jargon, pressure, costs and support.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          A second pair of eyes before compliance
        </h1>
        <p className="text-lg text-muted">
          Upload a social post, ad, web page, email or brochure and get a report in under a minute.
          Every finding names the rule behind it. Free, no sign-up.
        </p>
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        {CHECKERS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-6 transition hover:border-accent"
          >
            <h2 className="text-xl font-semibold">{c.title}</h2>
            <p className="text-sm text-muted">{c.body}</p>
            <span className="mt-2 font-medium text-accent">Start a check →</span>
          </Link>
        ))}
      </div>
      <Disclaimer />
    </div>
  );
}
