export function normalise(s: string) {
  return s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9£%' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * How much of `needle` appears, in order, inside `haystack`: the best share of
 * needle words covered by any window of the haystack the same length. 0 to 1.
 */
export function fuzzyContains(haystack: string, needle: string): number {
  const h = normalise(haystack).split(" ");
  const n = normalise(needle).split(" ");
  if (n.length === 0 || h.length === 0) return 0;
  const want = new Map<string, number>();
  for (const w of n) want.set(w, (want.get(w) ?? 0) + 1);

  let best = 0;
  const win = n.length;
  const have = new Map<string, number>();
  let matched = 0;
  const add = (w: string, d: 1 | -1) => {
    const before = Math.min(have.get(w) ?? 0, want.get(w) ?? 0);
    have.set(w, (have.get(w) ?? 0) + d);
    const after = Math.min(have.get(w) ?? 0, want.get(w) ?? 0);
    matched += after - before;
  };
  for (let i = 0; i < h.length; i++) {
    add(h[i], 1);
    if (i >= win) add(h[i - win], -1);
    best = Math.max(best, matched / n.length);
    if (best === 1) break;
  }
  return best;
}

function syllables(word: string) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  const groups = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
    .replace(/^y/, "")
    .match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 1);
}

/** Flesch-Kincaid grade level (US school grade; add 5 for an approximate reading age). */
export function readingGrade(text: string): number | null {
  const sents = sentences(text);
  const words = text.match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
  if (words.length < 30 || sents.length === 0) return null;
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  return (
    0.39 * (words.length / sents.length) + 11.8 * (syl / words.length) - 15.59
  );
}
