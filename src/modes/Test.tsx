import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CardBack, CardFront, Choices, isSelectionCorrect, ProgressBar, Rich, useKeys } from '../components/Common';
import { useI18n } from '../i18n';
import { buildOptions, hasKey, isMulti } from '../lib/cards';
import { shuffle } from '../lib/text';
import { countStudied, scheduleNow } from '../store';
import type { Answer, Card } from '../types';
import type { ModeProps } from './types';

interface Item {
  card: Card;
  options: Answer[];
}

type Phase = 'setup' | 'running' | 'done';

const COUNTS = [10, 20, 40];
const TIMES = [0, 15, 30, 60];

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export function Test({ pool, backTo }: ModeProps) {
  const { t } = useI18n();
  const playable = useMemo(() => pool.filter((c) => hasKey(c) && buildOptions(c, pool).length >= 2), [pool]);
  const [phase, setPhase] = useState<Phase>('setup');
  const [count, setCount] = useState(Math.min(20, playable.length));
  const [minutes, setMinutes] = useState(0);
  const [instant, setInstant] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [answers, setAnswers] = useState<Record<number, number[]>>({});
  const [locked, setLocked] = useState<Record<number, boolean>>({});
  const [index, setIndex] = useState(0);
  const [left, setLeft] = useState(0);
  const [added, setAdded] = useState(false);
  const deadline = useRef(0);

  const begin = (cards: Card[]) => {
    setItems(cards.map((card) => ({ card, options: buildOptions(card, pool) })));
    setAnswers({});
    setLocked({});
    setIndex(0);
    setAdded(false);
    deadline.current = minutes ? Date.now() + minutes * 60_000 : 0;
    setLeft(minutes * 60);
    setPhase('running');
    window.scrollTo(0, 0);
  };

  const finish = () => {
    items.forEach(() => countStudied());
    setPhase('done');
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    if (phase !== 'running' || !deadline.current) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.round((deadline.current - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        clearInterval(timer);
        setPhase('done');
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const item = items[index];
  const chosen = answers[index] ?? [];
  const revealed = !!locked[index];

  const toggle = (option: number) => {
    if (revealed) return;
    const next = !isMulti(item.options) ? [option] : chosen.includes(option) ? chosen.filter((i) => i !== option) : [...chosen, option];
    setAnswers({ ...answers, [index]: next });
    if (instant && !isMulti(item.options)) setLocked({ ...locked, [index]: true });
  };

  const requestFinish = () => {
    const missing = items.length - Object.values(answers).filter((a) => a.length).length;
    if (!missing || confirm(t('test.confirm', { n: missing }))) finish();
  };

  useKeys((e) => {
    if (phase !== 'running') return;
    const option = Number(e.key) - 1;
    if (option >= 0 && option < item.options.length) toggle(option);
    else if (e.key === 'ArrowRight' && index < items.length - 1) setIndex(index + 1);
    else if (e.key === 'ArrowLeft' && index > 0) setIndex(index - 1);
  });

  if (phase === 'setup') {
    return (
      <form className="panel setup" onSubmit={(e) => { e.preventDefault(); begin(shuffle(playable).slice(0, count)); }}>
        <h2>{t('test.setup')}</h2>
        <label className="field">
          <span className="label">{t('test.count')}</span>
          <select className="input" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {COUNTS.filter((n) => n < playable.length).map((n) => <option key={n} value={n}>{n}</option>)}
            <option value={playable.length}>{t('test.allCount', { n: playable.length })}</option>
          </select>
        </label>
        <label className="field">
          <span className="label">{t('test.time')}</span>
          <select className="input" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            {TIMES.map((n) => <option key={n} value={n}>{n ? t('test.minutes', { n }) : t('test.noLimit')}</option>)}
          </select>
        </label>
        <label className="check"><input type="checkbox" checked={instant} onChange={(e) => setInstant(e.target.checked)} /> {t('test.instant')}</label>
        <button className="btn primary wide">{t('test.start')}</button>
      </form>
    );
  }

  if (phase === 'done') {
    const outcome = items.map((it, i) => ({ ...it, given: answers[i] ?? [], ok: isSelectionCorrect(it.options, answers[i] ?? []) }));
    const correct = outcome.filter((o) => o.ok).length;
    const wrong = outcome.filter((o) => !o.ok);
    return (
      <div className="stack">
        <section className="panel result">
          <h2>{t('test.result')}</h2>
          <div className="stats">
            <div><b>{correct}/{items.length}</b><span>{t('test.correct')}</span></div>
            <div><b>{Math.round((correct / items.length) * 100)}%</b><span>{t('test.score')}</span></div>
            <div><b>{outcome.filter((o) => o.given.length).length}</b><span>{t('test.answered')}</span></div>
          </div>
          <div className="row">
            {wrong.length > 0 && <button type="button" className="btn primary" onClick={() => begin(wrong.map((w) => w.card))}>{t('test.retry')}</button>}
            {wrong.length > 0 && <button type="button" className="btn" disabled={added} onClick={() => { scheduleNow(wrong.map((w) => w.card.id)); setAdded(true); }}>{t(added ? 'test.added' : 'test.toReview')}</button>}
            <button type="button" className="btn" onClick={() => setPhase('setup')}>{t('test.new')}</button>
            <Link className="btn" to={backTo}>{t('common.backToCourse')}</Link>
          </div>
        </section>
        <h2 className="section-title">{wrong.length ? t('test.review', { n: wrong.length }) : t('test.noMistakes')}</h2>
        {wrong.map((w) => (
          <article key={w.card.id} className="study-card compact">
            <CardFront card={w.card} />
            <p className="review-line"><b>{t('test.your')}:</b> {w.given.length ? w.given.map((i) => <Rich key={i} text={w.options[i].t} format={w.options[i].f} inline />) : t('test.skipped')}</p>
            <div className="review-line ok"><b>{t('test.right')}:</b> <CardBack card={w.card} /></div>
          </article>
        ))}
      </div>
    );
  }

  const answered = Object.values(answers).filter((a) => a.length).length;

  return (
    <>
      <div className="study-bar">
        <span className="muted">{t('study.progress', { a: index + 1, b: items.length })}</span>
        <ProgressBar value={answered} max={items.length} />
        {deadline.current > 0 && <span className={`timer ${left < 60 ? 'urgent' : ''}`} aria-label={t('test.timeLeft')}>{clock(left)}</span>}
      </div>
      <article className="study-card">
        <CardFront card={item.card} />
        {isMulti(item.options) && <p className="hint left">{t('learn.multi')}</p>}
        <Choices options={item.options} selected={chosen} revealed={revealed} onToggle={toggle} />
        {revealed && <div className={`feedback ${isSelectionCorrect(item.options, chosen) ? 'ok' : 'no'}`} role="status"><b>{t(isSelectionCorrect(item.options, chosen) ? 'common.correct' : 'common.wrong')}</b><CardBack card={item.card} /></div>}
      </article>
      <div className="row between">
        <button type="button" className="btn" disabled={index === 0} onClick={() => setIndex(index - 1)}>{t('common.prev')}</button>
        <div className="row">
          {instant && isMulti(item.options) && !revealed && <button type="button" className="btn" disabled={!chosen.length} onClick={() => setLocked({ ...locked, [index]: true })}>{t('common.check')}</button>}
          {index < items.length - 1 ? (
            <button type="button" className="btn primary" onClick={() => setIndex(index + 1)}>{t('common.next')}</button>
          ) : (
            <button type="button" className="btn primary" onClick={requestFinish}>{t('test.finish')}</button>
          )}
        </div>
      </div>
      {index < items.length - 1 && <button type="button" className="text-btn" onClick={requestFinish}>{t('test.finish')}</button>}
    </>
  );
}
