import { useEffect, useMemo, type ReactNode } from 'react';
import { backPlain, correctAnswers } from '../lib/cards';
import { renderRich } from '../lib/rich';
import { useI18n } from '../i18n';
import type { Answer, Card, Format } from '../types';

export function Rich({ text, format, inline }: { text: string; format: Format; inline?: boolean }) {
  const html = useMemo(() => renderRich(text, format), [text, format]);
  const Tag = inline ? 'span' : 'div';
  return <Tag className="rich" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Replaces {name} placeholders in a translated sentence with links. */
export function Linked({ text, links }: { text: string; links: Record<string, [label: string, href: string]> }) {
  return (
    <>
      {text.split(/(\{\w+\})/).map((part, i) => {
        const link = part.startsWith('{') ? links[part.slice(1, -1)] : undefined;
        return link ? <a key={i} href={link[1]} target="_blank" rel="noreferrer">{link[0]}</a> : part;
      })}
    </>
  );
}

export const BASED_ON_LINKS: Record<string, [string, string]> = {
  zdaj: ['zdaj.se', 'https://pjatk.zdaj.se'],
  code: ['zdaj-se-pjatk', 'https://github.com/bibixx/zdaj-se-pjatk'],
  author: ['bibixx', 'https://github.com/bibixx'],
};

export function CardFront({ card }: { card: Card }) {
  return (
    <>
      <Rich text={card.front} format={card.format} />
      {card.code && <pre className="code">{card.code}</pre>}
    </>
  );
}

export function CardBack({ card }: { card: Card }) {
  const { t } = useI18n();
  const correct = correctAnswers(card);
  return (
    <>
      {correct.length > 0 ? (
        <ul className="back-list">
          {correct.map((a, i) => <li key={i}><Rich text={a.t} format={a.f} inline /></li>)}
        </ul>
      ) : card.back?.trim() ? (
        <Rich text={card.back} format={card.format === 'md' ? 'md' : 'text'} />
      ) : (
        <>
          {card.answers.length > 0 && (
            <ul className="answer-list">
              {card.answers.map((a, i) => <li key={i}><span aria-hidden>·</span><Rich text={a.t} format={a.f} inline /></li>)}
            </ul>
          )}
          <p className="muted">{t('common.noKey')}</p>
        </>
      )}
      {card.why && <p className="why">{card.why}</p>}
    </>
  );
}

const LETTERS = 'ABCDEFGHIJKL';

interface ChoicesProps {
  options: Answer[];
  selected: number[];
  revealed: boolean;
  onToggle: (index: number) => void;
}

export function Choices({ options, selected, revealed, onToggle }: ChoicesProps) {
  return (
    <div className="choices">
      {options.map((option, i) => {
        const isSelected = selected.includes(i);
        const state = !revealed ? (isSelected ? 'selected' : '') : option.c ? (isSelected ? 'correct' : 'missed') : isSelected ? 'wrong' : 'dim';
        return (
          <button type="button" key={i} className={`choice ${state}`} disabled={revealed} aria-pressed={isSelected} onClick={() => onToggle(i)}>
            <span className="choice-letter">{LETTERS[i]}</span>
            <Rich text={option.t} format={option.f} inline />
          </button>
        );
      })}
    </div>
  );
}

export const isSelectionCorrect = (options: Answer[], selected: number[]) =>
  options.every((option, i) => option.c === selected.includes(i));

export function ProgressBar({ value, max, label }: { value: number; max: number; label?: string }) {
  const percent = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={label}>
      <div style={{ width: `${percent}%` }} />
    </div>
  );
}

export function Message({ title, children }: { title?: string; children?: ReactNode }) {
  return (
    <div className="message">
      {title && <h2>{title}</h2>}
      {children}
    </div>
  );
}

export function Loading() {
  const { t } = useI18n();
  return <p className="muted loading" role="status">{t('common.loading')}</p>;
}

export function LoadError() {
  const { t } = useI18n();
  return <p className="alert" role="alert">{t('common.error')}</p>;
}

export function useTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · Zdaj PJA` : 'Zdaj PJA';
  }, [title]);
}

/** Runs a handler for keys pressed outside of form fields. */
export function useKeys(handler: (event: KeyboardEvent) => void) {
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.ctrlKey || event.metaKey || event.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      handler(event);
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  });
}

export { backPlain };
