import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CardFront, Message, ProgressBar, Rich, useKeys } from '../components/Common';
import { useI18n } from '../i18n';
import { buildStatement, type Statement } from '../lib/cards';
import { shuffle } from '../lib/text';
import { countStudied } from '../store';
import type { ModeProps } from './types';

const SESSION = 25;

export function TrueFalse({ pool, backTo }: ModeProps) {
  const { t } = useI18n();
  const build = useMemo(() => () => shuffle(pool).flatMap((c) => buildStatement(c, pool) ?? []).slice(0, SESSION) as Statement[], [pool]);
  const [items, setItems] = useState(build);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [given, setGiven] = useState<boolean | null>(null);

  const item = items[index];

  const answer = (value: boolean) => {
    if (given !== null) return;
    setGiven(value);
    if (value === item.truth) setScore(score + 1);
    countStudied();
  };
  const next = () => {
    setIndex(index + 1);
    setGiven(null);
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

  return (
    <>
      <div className="study-bar">
        <span className="muted">{t('study.progress', { a: index + 1, b: items.length })}</span>
        <ProgressBar value={index} max={items.length} />
      </div>
      <article className="study-card">
        <CardFront card={item.card} />
        <hr />
        <p className="hint left">{t('tf.claim')}</p>
        <div className="claim"><Rich text={item.claim} format={item.format} /></div>
        {given !== null && <div className={`feedback ${correct ? 'ok' : 'no'}`} role="status"><b>{t(correct ? 'common.correct' : 'common.wrong')}</b> {t(item.truth ? 'tf.true' : 'tf.false')}</div>}
      </article>
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
