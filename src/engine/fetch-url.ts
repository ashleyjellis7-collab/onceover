import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;
const USER_AGENT =
  "OnceoverBot/0.1 (+https://github.com/ashleyjellis7-collab/onceover)";

export class FetchError extends Error {}

/**
 * Fetch a public web page and return its visible text.
 *
 * A public "fetch any URL" box is a classic SSRF target, so this blocks private
 * and internal addresses, caps redirects and response size, and times out.
 * The brief moves full rendering (JS, screenshots, layout) to a separate
 * Playwright worker; this is the plain-HTML path.
 */
export async function fetchPageText(rawUrl: string): Promise<{ url: string; text: string }> {
  let url = parseUrl(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url.hostname);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": USER_AGENT, accept: "text/html,text/plain" },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new FetchError("Redirect without a location.");
      url = parseUrl(new URL(loc, url).toString());
      continue;
    }
    if (!res.ok) throw new FetchError(`Could not fetch the page (HTTP ${res.status}).`);
    const type = res.headers.get("content-type") ?? "";
    if (!/text\/(html|plain)/.test(type))
      throw new FetchError("That URL is not a web page. Upload the file instead.");
    const body = await readCapped(res);
    return { url: url.toString(), text: type.includes("html") ? htmlToText(body) : body };
  }
  throw new FetchError("Too many redirects.");
}

function parseUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new FetchError("That doesn't look like a valid URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new FetchError("Only http and https URLs can be checked.");
  if (url.username || url.password) throw new FetchError("URLs with credentials are not allowed.");
  return url;
}

async function assertPublicHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true }).catch(() => {
        throw new FetchError("Could not find that website.");
      });
  for (const { address } of addrs) {
    if (isPrivate(address)) throw new FetchError("That address is not allowed.");
  }
}

function isPrivate(ip: string): boolean {
  if (ip.startsWith("::ffff:")) return isPrivate(ip.slice(7));
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  return (
    v6 === "::" || v6 === "::1" ||
    v6.startsWith("fc") || v6.startsWith("fd") || // unique local
    v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb") // link local
  );
}

async function readCapped(res: Response) {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      break; // keep what we have; the top of the page matters most
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export function htmlToText(html: string) {
  return html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<img[^>]*\balt=["']([^"']*)["'][^>]*>/gi, " $1 ")
    .replace(/<\/?(p|div|section|article|li|h[1-6]|br|tr|header|footer)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&pound;/g, "£")
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}
