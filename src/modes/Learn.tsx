import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CardBack, CardFront, Choices, isSelectionCorrect, Message, ProgressBar, useKeys } from '../components/Common';
import { useI18n } from '../i18n';
import { buildOptions, hasKey, isMulti, typedAnswer } from '../lib/cards';
import { answersMatch, shuffle } from '../lib/text';
import { countStudied } from '../store';
import type { Answer, Card } from '../types';
import type { ModeProps } from './types';

const ROUND = 20;
const WINDOW = 7;
const MASTERED = 2;

interface Step {
  card: Card;
  kind: 'choice' | 'write';
  options: Answer[];
}

function pickNext(cards: Card[], levels: Record<string, number>, pool: Card[], lastId: string | null): Step | null {
  const active = cards.filter((c) => (levels[c.id] ?? 0) < MASTERED).slice(0, WINDOW);
  if (!active.length) return null;
  const candidates = active.length > 1 ? active.filter((c) => c.id !== lastId) : active;
  const card = candidates[Math.floor(Math.random() * candidates.length)];
  const typed = (levels[card.id] ?? 0) >= 1 && typedAnswer(card);
  return typed ? { card, kind: 'write', options: [] } : { card, kind: 'choice', options: buildOptions(card, pool) };
}

export function Learn({ pool, backTo }: ModeProps) {
  const { t } = useI18n();
  const playable = useMemo(() => pool.filter((c) => hasKey(c) && buildOptions(c, pool).length >= 2), [pool]);
  const [order, setOrder] = useState(() => shuffle(playable));
  const [offset, setOffset] = useState(0);
  const round = useMemo(() => order.slice(offset, offset + ROUND), [order, offset]);
  const levels = useRef<Record<string, number>>({});
  const [step, setStep] = useState<Step | null>(() => pickNext(order.slice(0, ROUND), {}, pool, null));
  const [selected, setSelected] = useState<number[]>([]);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<boolean | null>(null);

  const mastered = round.filter((c) => (levels.current[c.id] ?? 0) >= MASTERED).length;
  const revealed = result !== null;

  const settle = (correct: boolean) => {
    if (!step) return;
    const id = step.card.id;
    levels.current[id] = correct ? (levels.current[id] ?? 0) + 1 : 0;
    countStudied();
    setResult(correct);
  };

  const submitChoice = (indices: number[]) => {
    if (step) settle(isSelectionCorrect(step.options, indices));
  };

  const toggle = (index: number) => {
    if (!step || revealed) return;
    if (!isMulti(step.options)) {
      setSelected([index]);
      submitChoice([index]);
    } else {
      setSelected(selected.includes(index) ? selected.filter((i) => i !== index) : [...selected, index]);
    }
  };

  const advance = () => {
    setStep(pickNext(round, levels.current, pool, step?.card.id ?? null));
    setSelected([]);
    setTyped('');
    setResult(null);
  };

  const nextRound = () => {
    const nextOffset = offset + ROUND;
    const wrapped = nextOffset >= order.length;
    const nextOrder = wrapped ? shuffle(playable) : order;
    const start = wrapped ? 0 : nextOffset;
    levels.current = {};
    setOrder(nextOrder);
    setOffset(start);
    setStep(pickNext(nextOrder.slice(start, start + ROUND), {}, pool, null));
    setSelected([]);
    setTyped('');
    setResult(null);
  };

  useKeys((e) => {
    if (!step) return;
    if (revealed && (e.key === 'Enter' || e.code === 'Space')) {
      e.preventDefault();
      advance();
      return;
    }
    if (!revealed && step.kind === 'choice') {
      const index = Number(e.key) - 1;
      if (index >= 0 && index < step.options.length) toggle(index);
      else if (e.key === 'Enter' && selected.length) submitChoice(selected);
    }
  });

  if (!step) {
    return (
      <Message title={t('learn.done')}>
        <p>{t('learn.doneBody', { n: round.length })}</p>
        <div className="row center">
          <button type="button" className="btn primary" onClick={nextRound}>{t('learn.nextRound')}</button>
          <Link className="btn" to={backTo}>{t('common.backToCourse')}</Link>
        </div>
      </Message>
    );
  }

  const expected = step.kind === 'write' ? typedAnswer(step.card)! : '';

  return (
    <>
      <div className="study-bar">
        <span className="muted">{t('learn.mastered', { a: mastered, b: round.length })}</span>
        <ProgressBar value={mastered} max={round.length} />
      </div>
      <article className="study-card">
        <CardFront card={step.card} />
        {step.kind === 'choice' && isMulti(step.options) && !revealed && <p className="hint left">{t('learn.multi')}</p>}
        {step.kind === 'write' && !revealed && <p className="hint left">{t('learn.typeIt')}</p>}
        {step.kind === 'choice' && <Choices options={step.options} selected={selected} revealed={revealed} onToggle={toggle} />}
        {step.kind === 'write' && (
          <form onSubmit={(e) => { e.preventDefault(); if (!revealed && typed.trim()) settle(answersMatch(typed, expected)); }}>
            <input className="input" autoFocus value={typed} disabled={revealed} onChange={(e) => setTyped(e.target.value)} placeholder={t('write.placeholder')} aria-label={t('write.placeholder')} />
          </form>
        )}
        {revealed && (
          <div className={`feedback ${result ? 'ok' : 'no'}`} role="status">
            <b>{t(result ? 'common.correct' : 'common.wrong')}</b>
            {(!result || step.card.why) && <CardBack card={step.card} />}
          </div>
        )}
      </article>
      {revealed ? (
        <button type="button" className="btn primary wide" autoFocus onClick={advance}>{t('common.next')}</button>
      ) : step.kind === 'write' ? (
        <button type="button" className="btn primary wide" disabled={!typed.trim()} onClick={() => settle(answersMatch(typed, expected))}>{t('common.check')}</button>
      ) : isMulti(step.options) ? (
        <button type="button" className="btn primary wide" disabled={!selected.length} onClick={() => submitChoice(selected)}>{t('common.check')}</button>
      ) : null}
    </>
  );
}
