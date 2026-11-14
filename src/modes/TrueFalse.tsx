import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { CardFront, Message, ProgressBar, Rich, useKeys } from '../components/Common';
import { useI18n } from '../i18n';
import { buildStatement, type Statement } from '../lib/cards';
import { shuffle } from '../lib/text';
import { countStudied } from '../store';
import type { ModeProps } from './types';

const SESSION = 25;
/** Distance in px after which releasing the card counts as an answer. */
const SWIPE = 90;
/** A quick flick (px/ms) counts too, once the card has moved this far. */
const FLICK_SPEED = 0.45;
const FLICK_MIN = 28;
const EXIT_MS = 260;

const buzz = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* haptics are optional */
  }
};

interface Drag {
  id: number;
  x: number;
  lastX: number;
  lastT: number;
  speed: number;
  armed: boolean;
}

export function TrueFalse({ pool, backTo }: ModeProps) {
  const { t } = useI18n();
  const build = useMemo(() => () => shuffle(pool).flatMap((c) => buildStatement(c, pool) ?? []).slice(0, SESSION) as Statement[], [pool]);
  const [items, setItems] = useState(build);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [given, setGiven] = useState<boolean | null>(null);
  const deck = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const leaving = useRef(0);

  const item = items[index];
  const upcoming = items[index + 1];

  // The card follows the finger through CSS variables, so dragging never re-renders it.
  const place = (dx: number) => {
    deck.current?.style.setProperty('--dx', String(Math.round(dx)));
    deck.current?.style.setProperty('--p', String(Math.min(1, Math.abs(dx) / SWIPE)));
  };

  useLayoutEffect(() => {
    deck.current?.classList.remove('dragging', 'exiting');
    deck.current?.removeAttribute('data-armed');
    deck.current?.style.setProperty('--from', '0');
    place(0);
    leaving.current = 0;
  }, [index]);
  useEffect(() => () => clearTimeout(leaving.current), []);

  const answer = (value: boolean) => {
    if (given !== null) return;
    setGiven(value);
    if (value === item.truth) setScore(score + 1);
    countStudied();
  };
  const next = () => {
    setIndex((i) => i + 1);
    setGiven(null);
  };

  const flyOut = (direction: number) => {
    deck.current?.classList.add('exiting');
    place(direction * (window.innerWidth + 160));
    leaving.current = window.setTimeout(next, EXIT_MS);
  };

  const release = (moved: number) => {
    const direction = moved > 0 ? 1 : -1;
    if (given !== null) return flyOut(direction);
    const value = direction > 0;
    answer(value);
    if (value === item.truth) {
      buzz(12);
      flyOut(direction);
    } else {
      // Wrong: the card bounces back and stays, so the correction can be read.
      buzz([30, 60, 30]);
      deck.current?.style.setProperty('--from', String(Math.round(moved)));
      place(0);
    }
  };

  const endDrag = () => {
    drag.current = null;
    deck.current?.classList.remove('dragging');
    deck.current?.removeAttribute('data-armed');
  };
  const onDown = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'touch' || drag.current || leaving.current) return;
    // Leave wide code blocks and tables free to scroll sideways.
    for (let el = e.target as HTMLElement | null; el && el !== e.currentTarget; el = el.parentElement) {
      if (el.scrollWidth > el.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return;
    }
    drag.current = { id: e.pointerId, x: e.clientX, lastX: e.clientX, lastT: e.timeStamp, speed: 0, armed: false };
  };
  const onMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (d?.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    if (!deck.current?.classList.contains('dragging')) {
      if (Math.abs(dx) < 6) return;
      deck.current?.classList.add('dragging');
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.speed = 0.6 * d.speed + 0.4 * ((e.clientX - d.lastX) / dt);
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;
    const armed = Math.abs(dx) >= SWIPE;
    if (armed !== d.armed) {
      d.armed = armed;
      if (armed) buzz(8);
    }
    if (armed) deck.current?.setAttribute('data-armed', '');
    else deck.current?.removeAttribute('data-armed');
    place(dx);
  };
  const onUp = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (d?.id !== e.pointerId) return;
    const moved = e.clientX - d.x;
    const flick = Math.abs(d.speed) > FLICK_SPEED && Math.abs(moved) > FLICK_MIN && Math.sign(d.speed) === Math.sign(moved) && e.timeStamp - d.lastT < 80;
    endDrag();
    if (Math.abs(moved) >= SWIPE || flick) release(moved);
    else place(0);
  };
  const onCancel = () => {
    endDrag();
    place(0);
  };

  useKeys((e) => {
    if (!item) return;
    if (given !== null && (e.key === 'Enter' || e.code === 'Space')) {
      e.preventDefault();
      next();
    } else if (given === null && (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'f')) answer(false);
    else if (given === null && (e.key === 'ArrowRight' || e.key.toLowerCase() === 't' || e.key.toLowerCase() === 'p')) answer(true);
  });

  if (!item) {
    return (
      <Message title={t('write.done')}>
        <p>{t('tf.score', { a: score, b: items.length })}</p>
        <div className="row center">
          <button type="button" className="btn primary" onClick={() => { setItems(build()); setIndex(0); setScore(0); }}>{t('common.again')}</button>
          <Link className="btn" to={backTo}>{t('common.backToCourse')}</Link>
        </div>
      </Message>
    );
  }

  const correct = given === item.truth;
  const state = given === null ? '' : correct ? 'right' : 'rejected';

  return (
    <>
      <div className="study-bar">
        <span className="muted">{t('study.progress', { a: index + 1, b: items.length })}</span>
        <ProgressBar value={index} max={items.length} />
        <span key={score} className={`tally ${score ? 'pop' : ''}`} aria-label={t('tf.score', { a: score, b: items.length })}>✓ {score}</span>
      </div>
      <div className="deck" ref={deck}>
        {upcoming && (
          <div key={index + 1} className="study-card deck-next" aria-hidden="true">
            <CardFront card={upcoming.card} />
            <hr />
            <p className="hint left">{t('tf.claim')}</p>
            <div className="claim"><Rich text={upcoming.claim} format={upcoming.format} /></div>
          </div>
        )}
        <article
          key={index}
          className={`study-card swipe ${state}`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onCancel}
        >
          <span className={`swipe-tint ${given === null ? '' : 'neutral'}`} aria-hidden="true" />
          <span className={`swipe-stamp true ${given === null ? '' : 'neutral'}`} aria-hidden="true">{t(given === null ? 'tf.true' : 'common.next')}</span>
          <span className={`swipe-stamp false ${given === null ? '' : 'neutral'}`} aria-hidden="true">{t(given === null ? 'tf.false' : 'common.next')}</span>
          <CardFront card={item.card} />
          <hr />
          <p className="hint left">{t('tf.claim')}</p>
          <div className="claim"><Rich text={item.claim} format={item.format} /></div>
          {given !== null && <div className={`feedback ${correct ? 'ok' : 'no'}`} role="status"><b>{t(correct ? 'common.correct' : 'common.wrong')}</b> {t(item.truth ? 'tf.true' : 'tf.false')}</div>}
        </article>
      </div>
      <p className="hint touch-only">{t(given === null ? 'tf.swipe' : 'tf.swipeNext')}</p>
      {given === null ? (
        <div className="row center">
          <button type="button" className="btn bad grow" onClick={() => answer(false)}>{t('tf.false')}</button>
          <button type="button" className="btn good grow" onClick={() => answer(true)}>{t('tf.true')}</button>
        </div>
      ) : (
        <button type="button" className="btn primary wide" autoFocus onClick={next}>{t('common.next')}</button>
      )}
    </>
  );
}
