import { useEffect, useMemo, useState } from 'react';
import { Message } from '../components/Common';
import { useI18n } from '../i18n';
import { typedAnswer } from '../lib/cards';
import { toPlain } from '../lib/rich';
import { shuffle } from '../lib/text';
import { countStudied, recordMatch, useStore } from '../store';
import type { Card } from '../types';
import type { ModeProps } from './types';

const PAIRS = 6;
const MAX_LENGTH = 140;

interface Tile {
  key: string;
  pair: string;
  text: string;
}

function buildTiles(cards: Card[]): Tile[] {
  const seen = new Set<string>();
  const chosen = shuffle(cards).filter((c) => {
    const answer = typedAnswer(c)!;
    if (seen.has(answer)) return false;
    seen.add(answer);
    return true;
  }).slice(0, PAIRS);
  return shuffle(chosen.flatMap((c) => [
    { key: `${c.id}-q`, pair: c.id, text: toPlain(c.front, c.format) },
    { key: `${c.id}-a`, pair: c.id, text: typedAnswer(c)! },
  ]));
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

export function Match({ pool, storageKey }: ModeProps) {
  const { t } = useI18n();
  const playable = useMemo(() => pool.filter((c) => typedAnswer(c) && toPlain(c.front, c.format).length <= MAX_LENGTH && !c.code), [pool]);
  const [tiles, setTiles] = useState(() => buildTiles(playable));
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Tile | null>(null);
  const [wrong, setWrong] = useState<string[]>([]);
  const [start, setStart] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [finalTime, setFinalTime] = useState<number | null>(null);
  const best = useStore((s) => s.matchBest[storageKey]);

  useEffect(() => {
    if (finalTime !== null) return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [finalTime]);

  if (tiles.length < 8) return <Message><p>{t('course.needs')}</p></Message>;

  const pick = (tile: Tile) => {
    if (matched.has(tile.pair) || wrong.length) return;
    if (!selected) {
      setSelected(tile);
    } else if (selected.key === tile.key) {
      setSelected(null);
    } else if (selected.pair === tile.pair) {
      const next = new Set(matched).add(tile.pair);
      setMatched(next);
      setSelected(null);
      countStudied();
      if (next.size * 2 === tiles.length) {
        const time = Date.now() - start;
        setFinalTime(time);
        recordMatch(storageKey, time);
      }
    } else {
      setWrong([selected.key, tile.key]);
      setSelected(null);
      setTimeout(() => setWrong([]), 550);
    }
  };

  const restart = () => {
    setTiles(buildTiles(playable));
    setMatched(new Set());
    setSelected(null);
    setFinalTime(null);
    setStart(Date.now());
    setNow(Date.now());
  };

  return (
    <>
      <div className="study-bar">
        <span className="timer">{seconds(finalTime ?? now - start)}</span>
        {best && <span className="muted">{t('match.best')}: {seconds(best)}</span>}
      </div>
      {finalTime !== null && (
        <Message title={t('match.done', { t: seconds(finalTime) })}>
          <button type="button" className="btn primary" onClick={restart}>{t('match.new')}</button>
        </Message>
      )}
      {finalTime === null && (
        <div className="match-grid">
          {tiles.map((tile) => {
            const state = matched.has(tile.pair) ? 'gone' : wrong.includes(tile.key) ? 'miss' : selected?.key === tile.key ? 'picked' : '';
            return <button key={tile.key} type="button" className={`tile ${state}`} disabled={state === 'gone'} onClick={() => pick(tile)}>{tile.text}</button>;
          })}
        </div>
      )}
    </>
  );
}
