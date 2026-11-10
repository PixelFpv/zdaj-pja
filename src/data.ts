import { useEffect, useMemo, useState } from 'react';
import { bankCards, deckCards, questionToCard } from './lib/cards';
import { useStore } from './store';
import type { Card, Catalog, Course, MaterialFile, RawQuestion } from './types';

const BASE = `${import.meta.env.BASE_URL}data/`;
const requests = new Map<string, Promise<unknown>>();

function fetchJson<T>(path: string): Promise<T> {
  let request = requests.get(path);
  if (!request) {
    request = fetch(BASE + path).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${path}`);
      return r.json();
    });
    request.catch(() => requests.delete(path));
    requests.set(path, request);
  }
  return request as Promise<T>;
}

export interface Loaded<T> {
  data: T | null;
  error: boolean;
}

function useJson<T>(path: string | null): Loaded<T> {
  const [result, setResult] = useState<{ path: string | null; data: T | null; error: boolean }>({ path: null, data: null, error: false });
  useEffect(() => {
    if (!path) return;
    let live = true;
    fetchJson<T>(path).then(
      (data) => live && setResult({ path, data, error: false }),
      () => live && setResult({ path, data: null, error: true }),
    );
    return () => {
      live = false;
    };
  }, [path]);
  return result.path === path ? result : { data: null, error: false };
}

export const useCatalog = () => useJson<Catalog>('catalog.json');

export function useCourse(courseId: string | undefined): { course: Course | null; loading: boolean; error: boolean } {
  const { data, error } = useCatalog();
  const course = data?.courses.find((c) => c.id === courseId) ?? null;
  return { course, loading: !data && !error, error };
}

export const useMaterials = (course: Course | null) =>
  useJson<MaterialFile[]>(course?.files ? `files/${encodeURIComponent(course.id)}.json` : null);

/** Every card of a course: question banks, the user's own questions and generated decks. */
export function useCourseCards(course: Course | null): { cards: Card[]; loading: boolean; error: boolean } {
  const [banks, setBanks] = useState<{ id: string | null; data: Record<string, RawQuestion[]>; error: boolean }>({ id: null, data: {}, error: false });
  const scopes = useStore((s) => s.scopes);
  const studyLang = useStore((s) => s.studyLang);
  const allDecks = useStore((s) => s.decks);
  const local = useStore((s) => (course ? s.local[course.id] : undefined));

  useEffect(() => {
    if (!course) return;
    let live = true;
    Promise.all(course.banks.map((b) => fetchJson<RawQuestion[]>(`banks/${encodeURIComponent(b.id)}.json`))).then(
      (lists) => live && setBanks({ id: course.id, data: Object.fromEntries(course.banks.map((b, i) => [b.id, lists[i]])), error: false }),
      () => live && setBanks({ id: course.id, data: {}, error: true }),
    );
    return () => {
      live = false;
    };
  }, [course]);

  const ready = !!course && banks.id === course.id;
  const cards = useMemo(() => {
    if (!course || !ready) return [];
    // The student's own questions and decks are always shown; only shared banks are filtered.
    const fromBanks = course.banks.flatMap((b) => bankCards(b, course.id, (banks.data[b.id] ?? []).filter((q) => (q.l ?? 'pl') === studyLang), scopes));
    const mine = (local ?? []).map((q) => questionToCard(q, course.id, `local-${course.id}`, 'local', 'all', scopes));
    const decks = allDecks.filter((d) => d.courseId === course.id).flatMap((d) => deckCards(d, scopes));
    return [...fromBanks, ...mine, ...decks];
  }, [course, ready, banks, scopes, local, allDecks, studyLang]);

  return { cards, loading: !!course && !ready, error: ready && banks.error };
}
