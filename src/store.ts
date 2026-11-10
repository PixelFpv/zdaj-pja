import { useSyncExternalStore } from 'react';
import { grade, type Rating, type SrsState } from './lib/srs';
import type { Deck, RawQuestion, Scope } from './types';

const KEY = 'zdaj-pja.v1';

export interface State {
  srs: Record<string, SrsState>;
  local: Record<string, RawQuestion[]>;
  decks: Deck[];
  scopes: Record<string, Scope>;
  days: Record<string, number>;
  matchBest: Record<string, number>;
}

const empty = (): State => ({ srs: {}, local: {}, decks: [], scopes: {}, days: {}, matchBest: {} });

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    return empty();
  }
}

let state = load();
let saveFailed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function commit(next: State) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    saveFailed = false;
  } catch {
    saveFailed = true;
  }
  emit();
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = load();
      emit();
    }
  });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

export const getState = () => state;
export const lastSaveFailed = () => saveFailed;

const today = () => new Date().toLocaleDateString('sv');

export function countStudied() {
  const day = today();
  commit({ ...state, days: { ...state.days, [day]: (state.days[day] ?? 0) + 1 } });
}

export function rateCard(id: string, rating: Rating) {
  const day = today();
  commit({
    ...state,
    srs: { ...state.srs, [id]: grade(state.srs[id], rating) },
    days: { ...state.days, [day]: (state.days[day] ?? 0) + 1 },
  });
}

/** Puts missed cards at the front of the review queue. */
export function scheduleNow(ids: string[]) {
  const now = Date.now();
  const srs = { ...state.srs };
  for (const id of ids) {
    srs[id] = srs[id] ? { ...srs[id], due: now } : { ease: 2.5, interval: 0, due: now, reps: 0, lapses: 0, step: 0 };
  }
  commit({ ...state, srs });
}

export function setScope(id: string, scope: Scope) {
  commit({ ...state, scopes: { ...state.scopes, [id]: scope } });
}

export function saveLocalQuestions(courseId: string, questions: RawQuestion[]) {
  commit({ ...state, local: { ...state.local, [courseId]: questions } });
}

export function addDeck(deck: Deck) {
  commit({ ...state, decks: [deck, ...state.decks] });
}

export function removeDeck(id: string) {
  commit({ ...state, decks: state.decks.filter((d) => d.id !== id) });
}

export function recordMatch(key: string, ms: number) {
  if (!state.matchBest[key] || ms < state.matchBest[key]) {
    commit({ ...state, matchBest: { ...state.matchBest, [key]: ms } });
  }
}

export const exportState = () => JSON.stringify({ app: 'zdaj-pja', version: 1, state }, null, 1);

export function importState(json: string) {
  const parsed = JSON.parse(json);
  if (parsed?.app !== 'zdaj-pja' || typeof parsed.state !== 'object') throw new Error('invalid');
  commit({ ...empty(), ...parsed.state });
}

export const resetState = () => commit(empty());

/** Consecutive days with any study activity, ending today or yesterday. */
export function streak(days: Record<string, number>): number {
  const cursor = new Date();
  const key = () => cursor.toLocaleDateString('sv');
  if (!days[key()]) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (days[key()]) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
