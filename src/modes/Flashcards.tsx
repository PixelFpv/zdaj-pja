import { ChevronLeft, ChevronRight, Shuffle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CardBack, CardFront, Message, ProgressBar, useKeys } from '../components/Common';
import { useI18n } from '../i18n';
import { shuffle } from '../lib/text';
import { countStudied } from '../store';
import type { Card } from '../types';
import type { ModeProps } from './types';

export function Flashcards({ pool, backTo }: ModeProps) {
  const { t } = useI18n();
  const [deck, setDeck] = useState<Card[]>(() => shuffle(pool));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Record<string, boolean>>({});

  const done = index >= deck.length;
  const card = deck[index];

  const go = (next: number) => {
    setFlipped(false);
    setIndex(Math.max(0, next));
  };
  const mark = (value: boolean) => {
    setKnown({ ...known, [card.id]: value });
    countStudied();
    go(index + 1);
  };
  const restart = (cards: Card[]) => {
    setDeck(shuffle(cards));
    setKnown({});
    go(0);
  };

  useKeys((e) => {
    if (done) return;
    if (e.code === 'Space') {
      e.preventDefault();
      setFlipped((f) => !f);
    } else if (e.key === 'ArrowRight') go(Math.min(index + 1, deck.length - 1));
    else if (e.key === 'ArrowLeft') go(index - 1);
  });

  if (done) {
    const unknown = deck.filter((c) => !known[c.id]);
    return (
      <Message title={t('flash.done')}>
        <p>{t('flash.result', { a: deck.length - unknown.length, b: deck.length })}</p>
        <div className="row center">
          {unknown.length > 0 && <button type="button" className="btn primary" onClick={() => restart(unknown)}>{t('flash.repeatUnknown', { n: unknown.length })}</button>}
          <button type="button" className="btn" onClick={() => restart(pool)}>{t('common.again')}</button>
          <Link className="btn" to={backTo}>{t('common.backToCourse')}</Link>
        </div>
      </Message>
    );
  }

  return (
    <>
      <div className="study-bar">
        <span className="muted">{t('study.progress', { a: index + 1, b: deck.length })}</span>
        <ProgressBar value={index} max={deck.length} />
        <button type="button" className="icon-btn" onClick={() => restart(deck)} title={t('flash.shuffle')} aria-label={t('flash.shuffle')}><Shuffle size={16} aria-hidden /></button>
      </div>
      <button type="button" className={`flip ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)} aria-label={t('flash.flip')}>
        <span className="flip-inner">
          <span className="flip-face front"><span className="flip-content"><CardFront card={card} /></span></span>
          <span className="flip-face back"><span className="flip-content"><CardBack card={card} /></span></span>
        </span>
      </button>
      <p className="hint">{t('flash.hint')}</p>
      <div className="row center">
        <button type="button" className="icon-btn big" disabled={index === 0} onClick={() => go(index - 1)} aria-label={t('common.prev')}><ChevronLeft aria-hidden /></button>
        <button type="button" className="btn bad" onClick={() => mark(false)}>{t('flash.dontKnow')}</button>
        <button type="button" className="btn good" onClick={() => mark(true)}>{t('flash.know')}</button>
        <button type="button" className="icon-btn big" disabled={index === deck.length - 1} onClick={() => go(index + 1)} aria-label={t('common.next')}><ChevronRight aria-hidden /></button>
      </div>
    </>
  );
}
