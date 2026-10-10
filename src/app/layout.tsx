import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Onceover: Finprom & Consumer Duty pre-check",
  description:
    "Paste a URL or a financial promotion and get a free pre-check against FCA financial promotion rules and the Consumer Duty, with the rule behind every finding.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-GB"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-line">
          <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
            <Link href="/" className="font-semibold">
              Onceover
            </Link>
            <div className="flex gap-4 text-sm text-muted">
              <Link href="/finprom" className="hover:text-foreground">
                Finprom
              </Link>
              <Link href="/consumer-duty" className="hover:text-foreground">
                Consumer Duty
              </Link>
              <Link href="/methodology" className="hover:text-foreground">
                Methodology
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">{children}</main>
      </body>
    </html>
  );
}
