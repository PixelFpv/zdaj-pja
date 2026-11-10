import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CardBack, CardFront, Message, useKeys } from '../components/Common';
import { useI18n } from '../i18n';
import { formatDelay, nextCardId, nextDelay, type Rating } from '../lib/srs';
import { shuffle } from '../lib/text';
import { getState, rateCard } from '../store';
import type { ModeProps } from './types';

const NEW_PER_SESSION = 20;
const RATINGS: { rating: Rating; key: 'review.again' | 'review.hard' | 'review.good' | 'review.easy'; style: string }[] = [
  { rating: 1, key: 'review.again', style: 'bad' },
  { rating: 2, key: 'review.hard', style: '' },
  { rating: 3, key: 'review.good', style: 'good' },
  { rating: 4, key: 'review.easy', style: 'good' },
];

export function Review({ pool, backTo }: ModeProps) {
  const { t, lang } = useI18n();
  const order = useMemo(() => shuffle(pool), [pool]);
  const ids = useMemo(() => order.map((c) => c.id), [order]);
  const byId = useMemo(() => new Map(order.map((c) => [c.id, c])), [order]);
  const [newLeft, setNewLeft] = useState(NEW_PER_SESSION);
  const [currentId, setCurrentId] = useState(() => nextCardId(ids, getState().srs, NEW_PER_SESSION));
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  const card = currentId ? byId.get(currentId) : undefined;
  const state = currentId ? getState().srs[currentId] : undefined;

  const rate = (rating: Rating) => {
    if (!currentId) return;
    const wasNew = !state;
    rateCard(currentId, rating);
    const left = wasNew ? newLeft - 1 : newLeft;
    setNewLeft(left);
    setReviewed(reviewed + 1);
    setRevealed(false);
    setCurrentId(nextCardId(ids, getState().srs, left));
  };

  const addMore = () => {
    setNewLeft(NEW_PER_SESSION);
    setCurrentId(nextCardId(ids, getState().srs, NEW_PER_SESSION));
  };

  useKeys((e) => {
    if (!card) return;
    if (!revealed && (e.code === 'Space' || e.key === 'Enter')) {
      e.preventDefault();
      setRevealed(true);
    } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
      rate(Number(e.key) as Rating);
    }
  });

  if (!card) {
    const hasNew = ids.some((id) => !getState().srs[id]);
    return (
      <Message title={t('review.done')}>
        <p>{t('review.doneBody', { n: reviewed })}</p>
        <div className="row center">
          {hasNew && <button type="button" className="btn primary" onClick={addMore}>{t('review.more')}</button>}
          <Link className="btn" to={backTo}>{t('common.backToCourse')}</Link>
        </div>
      </Message>
    );
  }

  return (
    <>
      <div className="study-bar">
        <span className="muted">{t('review.new')}: {newLeft}</span>
        <span className="muted">{reviewed}</span>
      </div>
      <article className="study-card">
        <CardFront card={card} />
        {revealed && <><hr /><CardBack card={card} /></>}
      </article>
      {revealed ? (
        <div className="ratings">
          {RATINGS.map(({ rating, key, style }) => (
            <button key={rating} type="button" className={`btn ${style}`} onClick={() => rate(rating)}>
              <small>{formatDelay(nextDelay(state, rating), lang)}</small>
              {t(key)}
            </button>
          ))}
        </div>
      ) : (
        <button type="button" className="btn primary wide" onClick={() => setRevealed(true)}>{t('review.show')}</button>
      )}
    </>
  );
}
