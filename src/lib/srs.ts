/** Anki-style spaced repetition: learning steps, then SM-2 intervals. */

export type Rating = 1 | 2 | 3 | 4; // again, hard, good, easy

export interface SrsState {
  ease: number;
  /** Current interval in days; 0 while in learning. */
  interval: number;
  /** Timestamp (ms) when the card is due. */
  due: number;
  reps: number;
  lapses: number;
  /** Index in LEARNING_STEPS, or -1 once graduated. */
  step: number;
}

const MINUTE = 60_000;
const DAY = 86_400_000;
export const LEARNING_STEPS = [MINUTE, 10 * MINUTE];
const RELEARN_DELAY = 10 * MINUTE;
const MIN_EASE = 1.3;
const START_EASE = 2.5;
const GRADUATE_DAYS = 1;
const EASY_DAYS = 4;

export const newState = (now = Date.now()): SrsState => ({
  ease: START_EASE,
  interval: 0,
  due: now,
  reps: 0,
  lapses: 0,
  step: 0,
});

export function grade(state: SrsState | undefined, rating: Rating, now = Date.now()): SrsState {
  const s = state ?? newState(now);
  const reps = s.reps + 1;

  if (s.step >= 0) {
    if (rating === 4) return { ...s, reps, step: -1, interval: Math.max(EASY_DAYS, s.interval), due: now + EASY_DAYS * DAY };
    if (rating === 1) return { ...s, reps, step: 0, due: now + LEARNING_STEPS[0] };
    if (rating === 2) {
      const next = LEARNING_STEPS[Math.min(s.step + 1, LEARNING_STEPS.length - 1)];
      return { ...s, reps, due: now + (LEARNING_STEPS[s.step] + next) / 2 };
    }
    const step = s.step + 1;
    if (step >= LEARNING_STEPS.length) {
      const interval = Math.max(GRADUATE_DAYS, s.interval);
      return { ...s, reps, step: -1, interval, due: now + interval * DAY };
    }
    return { ...s, reps, step, due: now + LEARNING_STEPS[step] };
  }

  if (rating === 1) {
    return {
      ...s,
      reps,
      lapses: s.lapses + 1,
      ease: Math.max(MIN_EASE, s.ease - 0.2),
      interval: Math.max(1, Math.round(s.interval / 2)),
      step: LEARNING_STEPS.length - 1,
      due: now + RELEARN_DELAY,
    };
  }

  let ease = s.ease;
  let interval: number;
  if (rating === 2) {
    ease = Math.max(MIN_EASE, ease - 0.15);
    interval = s.interval * 1.2;
  } else if (rating === 3) {
    interval = s.interval * ease;
  } else {
    interval = s.interval * ease * 1.3;
    ease += 0.15;
  }
  interval = Math.max(s.interval + 1, Math.round(interval));
  return { ...s, reps, ease, interval, due: now + interval * DAY };
}

export const isDue = (state: SrsState | undefined, now = Date.now()) => !!state && state.due <= now;

/** Time until a card returns, used for the labels on the rating buttons. */
export const nextDelay = (state: SrsState | undefined, rating: Rating, now = Date.now()) =>
  grade(state, rating, now).due - now;

export function formatDelay(ms: number, lang: 'pl' | 'en'): string {
  const minutes = Math.round(ms / MINUTE);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return lang === 'pl' ? `${days} d` : `${days}d`;
  const months = Math.round(days / 30);
  if (months < 12) return lang === 'pl' ? `${months} mies.` : `${months} mo`;
  return lang === 'pl' ? `${(days / 365).toFixed(1)} lat` : `${(days / 365).toFixed(1)} y`;
}

/**
 * Picks the next card: anything already due first, then new cards up to the
 * limit, and finally a learning card that is not due yet so a session can finish.
 */
export function nextCardId(
  ids: string[],
  states: Record<string, SrsState | undefined>,
  newLeft: number,
  now = Date.now(),
): string | null {
  let dueId: string | null = null;
  let dueAt = Infinity;
  let newId: string | null = null;
  let soonId: string | null = null;
  let soonAt = Infinity;

  for (const id of ids) {
    const s = states[id];
    if (!s) {
      newId ??= id;
    } else if (s.due <= now) {
      if (s.due < dueAt) {
        dueAt = s.due;
        dueId = id;
      }
    } else if (s.step >= 0 && s.due < soonAt) {
      soonAt = s.due;
      soonId = id;
    }
  }
  return dueId ?? (newLeft > 0 ? newId : null) ?? soonId;
}
