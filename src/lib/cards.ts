import type { Answer, Bank, Card, Deck, Format, RawQuestion, Scope } from '../types';
import { shuffle } from './text';
import { toPlain } from './rich';

export function questionToCard(q: RawQuestion, courseId: string, sourceId: string, sourceLabel: string, scope: Scope, overrides: Record<string, Scope>): Card {
  const id = `${sourceId}:${q.id}`;
  return {
    id,
    courseId,
    sourceId,
    sourceLabel,
    front: q.q,
    format: q.f,
    code: q.code,
    back: q.back,
    answers: q.a ?? [],
    why: q.why,
    scope: overrides[id] ?? q.scope ?? scope,
    tags: q.tags ?? [],
    comments: q.cm ?? [],
    src: q.src,
  };
}

export const bankCards = (bank: Bank, courseId: string, questions: RawQuestion[], overrides: Record<string, Scope>) =>
  questions.map((q) => questionToCard(q, courseId, bank.id, bank.title, bank.scope, overrides));

export function deckCards(deck: Deck, overrides: Record<string, Scope>): Card[] {
  const sourceId = `deck-${deck.id}`;
  return deck.cards.map((c) => {
    const id = `${sourceId}:${c.id}`;
    return {
      id,
      courseId: deck.courseId,
      sourceId,
      sourceLabel: deck.name,
      front: c.front,
      format: 'text' as Format,
      back: c.back || undefined,
      answers: (c.answers ?? []).map((a) => ({ ...a, f: 'text' as Format })),
      scope: overrides[id] ?? deck.scope,
      tags: [],
      comments: [],
    };
  });
}

export const correctAnswers = (card: Card) => card.answers.filter((a) => a.c);
export const hasKey = (card: Card) => correctAnswers(card).length > 0 || !!card.back?.trim();

export function backPlain(card: Card): string {
  const correct = correctAnswers(card);
  if (correct.length) return correct.map((a) => toPlain(a.t, a.f)).join('; ');
  return card.back ?? '';
}

/** Answer options for a choice question; distractors come from the rest of the pool when needed. */
export function buildOptions(card: Card, pool: Card[]): Answer[] {
  if (card.answers.length >= 2) return shuffle(card.answers);
  if (!card.back?.trim()) return [];
  const others = shuffle(pool)
    .filter((c) => c.id !== card.id && c.back?.trim() && c.back !== card.back)
    .slice(0, 3)
    .map((c) => ({ t: c.back!, c: false, f: 'text' as Format }));
  return others.length ? shuffle([{ t: card.back, c: true, f: 'text' as Format }, ...others]) : [];
}

export const isMulti = (options: Answer[]) => options.filter((a) => a.c).length > 1;

/** A short, unambiguous answer that can reasonably be typed from memory. */
export function typedAnswer(card: Card): string | null {
  const correct = correctAnswers(card);
  let answer: string | null = null;
  if (correct.length === 1 && !/<img|!\[/i.test(correct[0].t)) answer = toPlain(correct[0].t, correct[0].f);
  else if (!correct.length && card.back?.trim()) answer = card.back.trim();
  return answer && answer.length <= 90 && !answer.includes('\n') ? answer : null;
}

export interface Statement {
  card: Card;
  claim: string;
  format: Format;
  truth: boolean;
}

export function buildStatement(card: Card, pool: Card[]): Statement | null {
  if (card.answers.length >= 2 && correctAnswers(card).length) {
    const answer = shuffle(card.answers)[0];
    return { card, claim: answer.t, format: answer.f, truth: answer.c };
  }
  if (!card.back?.trim()) return null;
  const other = shuffle(pool).find((c) => c.id !== card.id && c.back?.trim() && c.back !== card.back);
  if (other && Math.random() < 0.5) return { card, claim: other.back!, format: 'text', truth: false };
  return { card, claim: card.back, format: 'text', truth: true };
}

export function filterScope(cards: Card[], scope: Scope): Card[] {
  return scope === 'all' ? cards : cards.filter((c) => c.scope === scope);
}
