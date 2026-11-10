import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CardFront, Message, ProgressBar, Rich } from '../components/Common';
import { useI18n } from '../i18n';
import { shuffle } from '../lib/text';
import { countStudied, saveOpen, useStore } from '../store';
import type { ModeProps } from './types';

export function OpenQuestions({ pool, backTo }: ModeProps) {
  const { t } = useI18n();
  const progress = useStore((s) => s.open);
  const [order, setOrder] = useState(() => shuffle(pool));
  const [hideKnown, setHideKnown] = useState(false);
  const [index, setIndex] = useState(0);

  const known = useMemo(() => pool.filter((c) => progress[c.id]?.known).length, [pool, progress]);
  // Filtered once per pass, so marking a card does not shift the one on screen.
  const deck = useMemo(() => (hideKnown ? order.filter((c) => !progress[c.id]?.known) : order), [order, hideKnown]); // eslint-disable-line react-hooks/exhaustive-deps
  const card = deck[index];

  const restart = () => {
    setOrder(shuffle(pool));
    setIndex(0);
  };

  if (!card) {
    return (
      <Message title={t('open.done')}>
        <p>{t('open.doneBody', { a: known, b: pool.length })}</p>
        <div className="row center">
          <button type="button" className="btn primary" onClick={restart}>{t('open.restart')}</button>
          <Link className="btn" to={backTo}>{t('common.backToCourse')}</Link>
        </div>
      </Message>
    );
  }

  const mark = (value: boolean) => {
    saveOpen(card.id, { known: value });
    countStudied();
    setIndex(index + 1);
  };

  return (
    <>
      <div className="study-bar">
        <span className="muted">{t('study.progress', { a: index + 1, b: deck.length })}</span>
        <ProgressBar value={known} max={pool.length} label={t('open.known', { a: known, b: pool.length })} />
        <label className="check small"><input type="checkbox" checked={hideKnown} onChange={(e) => { setHideKnown(e.target.checked); setIndex(0); }} /> {t('open.hideKnown')}</label>
      </div>
      <article className="study-card">
        <CardFront card={card} />
        {card.answers.length > 0 && (
          <div>
            <span className="label">{t('open.options')}</span>
            <ul className="answer-list">
              {card.answers.map((a, i) => <li key={i}><span aria-hidden>{String.fromCharCode(97 + i)})</span><Rich text={a.t} format={a.f} inline /></li>)}
            </ul>
          </div>
        )}
        <label className="field">
          <span className="label">{t('open.note')}</span>
          {/* Keyed by card so each question starts from its own saved note. */}
          <textarea key={card.id} className="input" rows={4} defaultValue={progress[card.id]?.note ?? ''} onBlur={(e) => saveOpen(card.id, { note: e.target.value })} />
        </label>
        <p className="hint left">{t('open.noKeyHint')}</p>
        {card.src && <p className="hint left">{t('open.source')}: {card.src}</p>}
      </article>
      <div className="row between">
        <button type="button" className="btn" disabled={index === 0} onClick={() => setIndex(index - 1)}>{t('common.prev')}</button>
        <div className="row">
          <button type="button" className="btn bad" onClick={() => mark(false)}>{t('open.again')}</button>
          <button type="button" className="btn good" onClick={() => mark(true)}>{t('open.know')}</button>
        </div>
      </div>
    </>
  );
}
