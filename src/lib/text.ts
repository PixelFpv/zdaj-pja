const shuffleRandom = Math.random;

export function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(shuffleRandom() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Lowercases and strips diacritics, punctuation and extra spaces for answer comparison. */
export function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

/** True for an exact match after normalization, or a small typo on a longer answer. */
export function answersMatch(given: string, expected: string): boolean {
  const a = normalizeAnswer(given);
  const b = normalizeAnswer(expected);
  if (!a || !b) return false;
  if (a === b) return true;
  return b.length >= 5 && levenshtein(a, b) <= Math.floor(b.length * 0.15);
}
