import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CardFront, Message, ProgressBar } from '../components/Common';
import { useI18n } from '../i18n';
import { typedAnswer } from '../lib/cards';
import { answersMatch, shuffle } from '../lib/text';
import { countStudied } from '../store';
import type { ModeProps } from './types';

const SESSION = 25;

export function Write({ pool, backTo }: ModeProps) {
  const { t } = useI18n();
  const playable = useMemo(() => pool.filter((c) => typedAnswer(c)), [pool]);
  const [deck, setDeck] = useState(() => shuffle(playable).slice(0, SESSION));
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<boolean | null>(null);

  const card = deck[index];

  if (!card) {
    return (
      <Message title={t('write.done')}>
        <p>{t('write.score', { a: score, b: deck.length })}</p>
        <div className="row center">
          <button type="button" className="btn primary" onClick={() => { setDeck(shuffle(playable).slice(0, SESSION)); setIndex(0); setScore(0); }}>{t('common.again')}</button>
          <Link className="btn" to={backTo}>{t('common.backToCourse')}</Link>
        </div>
      </Message>
    );
  }

  const expected = typedAnswer(card)!;
  const next = () => {
    setIndex(index + 1);
    setValue('');
    setResult(null);
  };
  const submit = () => {
    if (result !== null) {
      next();
      return;
    }
    if (!value.trim()) return;
    const correct = answersMatch(value, expected);
    setResult(correct);
    if (correct) setScore(score + 1);
    countStudied();
  };

  return (
    <>
      <div className="study-bar">
        <span className="muted">{t('study.progress', { a: index + 1, b: deck.length })}</span>
        <ProgressBar value={index} max={deck.length} />
      </div>
      <article className="study-card">
        <CardFront card={card} />
        <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <input key={card.id} className="input" autoFocus value={value} readOnly={result !== null} onChange={(e) => setValue(e.target.value)} placeholder={t('write.placeholder')} aria-label={t('write.placeholder')} />
        </form>
        {result !== null && (
          <div className={`feedback ${result ? 'ok' : 'no'}`} role="status">
            <b>{t(result ? 'common.correct' : 'common.wrong')}</b>
            <p>{t('write.correctIs')} <b>{expected}</b></p>
            {!result && <button type="button" className="btn small" onClick={() => { setScore(score + 1); next(); }}>{t('write.iWasRight')}</button>}
          </div>
        )}
      </article>
      <button type="button" className="btn primary wide" disabled={result === null && !value.trim()} onClick={submit}>{t(result === null ? 'common.check' : 'common.next')}</button>
    </>
  );
}
