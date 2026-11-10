import type { Draft } from '../types';
import { normalizeAnswer } from './text';

const MAX_CARDS = 600;
const MAX_FRONT = 500;
const MAX_ANSWER_LINES = 8;

const OPTION = /^\s*([*+✓✔]|\[x\]|\(x\))?\s*([a-hA-H])\s*[).:]\s+(.+?)\s*(\*|\+|✓|✔|\(poprawna\)|\(correct\))?\s*$/;
const BULLET_OPTION = /^\s*([□☐■☑☒])\s*(.+)$/;
const NUMBERED = /^\s*(?:zad(?:anie)?\.?\s*|pytanie\s*|question\s*)?\d{1,3}\s*[.):]\s*(\S.*)$/i;
const EXPLICIT_Q = /^\s*(?:pytanie|question|pyt|q)\s*(?:\d{1,3})?\s*[:.]\s*(.+)$/i;
const EXPLICIT_A = /^\s*(?:odpowied[zź]|odp|answer|ans|a)\s*[:.]\s*(.*)$/i;
const KEY_LINE = /^\s*(?:poprawna|prawidłowa|odpowied[zź]|odp|answer)\s*(?:odpowied[zź])?\s*[:.=-]\s*([a-hA-H](?:\s*[,i]?\s*[a-hA-H])*)\s*\.?\s*$/i;
const BULLET = /^\s*(?:[-–—•*▪◦·‣o]\s+)(.+)$/;
const DEFINITION = /^([\p{Lu}0-9][\p{L}\p{N} /()'"-]{1,70}?)\s+(?:[-–—]|to|jest to|są to|oznacza|nazywamy)\s+(\S.{14,500})$/u;
const COLON_DEFINITION = /^([\p{Lu}][\p{L}\p{N} /()-]{1,60}):\s+(\S.{14,500})$/u;
/** Lines that look like code never make useful definitions. */
const CODE_LIKE = /[;{}]|==|\+\+|\w\(.*\)\s*$|^\s*(?:for|if|while|public|class|int|select|#include)\b/i;
const NOISE = /^(?:strona\s+\d+|page\s+\d+|\d+\s*(?:\/|z)\s*\d+|\d{1,4}|https?:\/\/\S+|©.*|imi[eę] i nazwisko.*|nr indeksu.*|grupa\s*:?.*)$/i;
const GENERIC_TERM = /^(?:przyk[lł]ad|np|uwaga|wniosek|rozwi[aą]zanie|odpowied[zź]|example|note|answer|solution)\.?$/i;
const SEPARATOR = /^\s*[=_*~-]{3,}\s*$/;
const PM_SUFFIX = /^\s*(\S.*?)\s+([+-])\s*$/;
const PM_PREFIX = /^\s*([+-])\s+(\S.*)$/;
const TASK_HEADER = /^\s*zad(?:anie)?\.?\s*\d{1,3}\s*(?:\([^)]*\))?\s*[.:]?\s*$/i;
/** Question words, plus Polish infinitives such as "Wypisać" that start exam tasks. */
const OPEN_START = /^(?:\p{L}+(?:ać|ić|eć|yć|ąć|ść|źć)(?=\s|$)|(?:napisz|podaj|wymie[nń]|opisz|wyja[sś]nij|omów|zdefiniuj|jak|co|czym|kiedy|dlaczego|ile|który|która|które|czy|what|why|how|when|which|define|explain|describe|list)(?=[\s,:]|$))/iu;

export function cleanText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/­/g, '')
    // PDF bullets are often private-use glyphs that no web font can display.
    .replace(/[-]/g, '•')
    .replace(/[   ]/g, ' ')
    .replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const wordCount = (s: string) => s.trim().split(/\s+/).length;
const isBlank = (s: string | undefined) => s === undefined || !s.trim();
const isOption = (s: string) => OPTION.test(s) || BULLET_OPTION.test(s);

function questionStem(line: string): string | null {
  const explicit = EXPLICIT_Q.exec(line);
  if (explicit) return explicit[1].trim();
  const numbered = NUMBERED.exec(line);
  if (numbered) return numbered[1].trim();
  const trimmed = line.trim();
  if (trimmed.endsWith('?') && wordCount(trimmed) >= 3) return trimmed;
  return null;
}

function parseKey(line: string): string[] | null {
  const key = KEY_LINE.exec(line);
  return key ? key[1].toLowerCase().match(/[a-h]/g) : null;
}

interface Options {
  cloze?: boolean;
  file?: string;
}

/** Turns plain text into study card drafts using only local pattern matching. */
export function generateCards(raw: string, options: Options = {}): Draft[] {
  const lines = cleanText(raw).split('\n');
  const used = new Array(lines.length).fill(false);
  const drafts: Draft[] = [];

  const take = (from: number, to: number) => used.fill(true, from, to);

  takePlusMinusBlocks(lines, used, drafts, options.file);
  takeTaskHeaders(lines, used, drafts, options.file);

  for (let i = 0; i < lines.length; i++) {
    if (used[i]) continue;
    const stem = questionStem(lines[i]);
    if (!stem) continue;

    // Stems wrapped over several lines end at the first option or blank line.
    let cursor = i + 1;
    let front = stem;
    while (cursor < lines.length && !isBlank(lines[cursor]) && !isOption(lines[cursor]) && !front.endsWith('?')
      && !EXPLICIT_A.test(lines[cursor]) && !questionStem(lines[cursor]) && cursor - i < 5) {
      front += ` ${lines[cursor].trim()}`;
      cursor++;
    }

    let scan = cursor;
    while (scan < lines.length && isBlank(lines[scan]) && scan - cursor < 2) scan++;

    // a) b) c) answer options
    if (scan < lines.length && isOption(lines[scan])) {
      const answers: { t: string; c: boolean; letter: string }[] = [];
      let j = scan;
      let letter = 97;
      for (; j < lines.length; j++) {
        const option = OPTION.exec(lines[j]);
        const box = BULLET_OPTION.exec(lines[j]);
        if (option) {
          answers.push({ t: option[3].trim(), c: !!(option[1] || option[4]), letter: option[2].toLowerCase() });
        } else if (box) {
          answers.push({ t: box[2].trim(), c: /[■☑☒]/.test(box[1]), letter: String.fromCharCode(letter) });
          letter++;
        } else if (!isBlank(lines[j]) && answers.length && !questionStem(lines[j]) && !parseKey(lines[j])) {
          answers[answers.length - 1].t += ` ${lines[j].trim()}`;
        } else {
          break;
        }
      }
      if (answers.length >= 2) {
        const key = j < lines.length ? parseKey(lines[j]) : null;
        if (key) {
          answers.forEach((a) => { a.c = key.includes(a.letter); });
          j++;
        }
        const correct = answers.filter((a) => a.c);
        drafts.push({
          front,
          back: correct.map((a) => a.t).join('\n'),
          type: 'mcq',
          file: options.file,
          answers: answers.map(({ t, c }) => ({ t, c })),
        });
        take(i, j);
        i = j - 1;
        continue;
      }
    }

    // Explicit "Odp:" or a paragraph directly following the question
    const answerLines: string[] = [];
    let j = scan;
    const explicit = j < lines.length ? EXPLICIT_A.exec(lines[j]) : null;
    if (explicit) {
      if (explicit[1].trim()) answerLines.push(explicit[1].trim());
      j++;
    }
    const inlineAllowed = explicit || scan === cursor || NUMBERED.test(lines[i]);
    if (inlineAllowed) {
      for (; j < lines.length && answerLines.length < MAX_ANSWER_LINES; j++) {
        if (used[j] || isBlank(lines[j]) || questionStem(lines[j]) || isOption(lines[j])) break;
        answerLines.push(lines[j].trim());
      }
    }

    const isQuestionLike = front.endsWith('?') || OPEN_START.test(front) || !!EXPLICIT_Q.exec(lines[i]);
    if (answerLines.length) {
      if (!isQuestionLike && !explicit) continue;
      drafts.push({ front, back: answerLines.join('\n'), type: 'qa', file: options.file });
      take(i, j);
      i = j - 1;
    } else if (isQuestionLike && front.length <= MAX_FRONT) {
      drafts.push({ front, back: '', type: 'open', file: options.file });
      take(i, cursor);
      i = cursor - 1;
    }
  }

  // Definitions and heading + bullets from what is left
  for (let i = 0; i < lines.length; i++) {
    if (used[i] || isBlank(lines[i])) continue;
    const line = lines[i].trim();
    if (NOISE.test(line)) continue;

    const bullets: string[] = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      const bullet = BULLET.exec(lines[j]);
      if (bullet && !used[j]) bullets.push(bullet[1].trim());
      else if (bullets.length && !isBlank(lines[j]) && !used[j] && /^\s+\S/.test(lines[j])) bullets[bullets.length - 1] += ` ${lines[j].trim()}`;
      else break;
    }
    if (bullets.length >= 2 && !BULLET.test(line) && wordCount(line) <= 12 && !CODE_LIKE.test(line)) {
      drafts.push({ front: line.replace(/[:.]$/, ''), back: bullets.map((b) => `• ${b}`).join('\n'), type: 'outline', file: options.file });
      take(i, j);
      i = j - 1;
      continue;
    }

    if (CODE_LIKE.test(line)) continue;
    const candidate = line.replace(BULLET, '$1');
    const definition = DEFINITION.exec(candidate) ?? COLON_DEFINITION.exec(candidate);
    if (definition && wordCount(definition[1]) <= 7 && !GENERIC_TERM.test(definition[1].trim())) {
      let back = definition[2].trim();
      let k = i + 1;
      while (k < lines.length && !used[k] && !isBlank(lines[k]) && !/[.!?]$/.test(back) && k - i < 4
        && !BULLET.test(lines[k]) && !DEFINITION.test(lines[k].trim())) {
        back += ` ${lines[k].trim()}`;
        k++;
      }
      drafts.push({ front: definition[1].trim(), back, type: 'definition', file: options.file });
      take(i, k);
      i = k - 1;
    }
  }

  if (options.cloze) drafts.push(...clozeCards(lines, used, options.file));

  return dedupe(drafts).slice(0, MAX_CARDS);
}

/** The format used across PJATK notes: a stem, then answers ending (or starting) with + or -. */
function takePlusMinusBlocks(lines: string[], used: boolean[], drafts: Draft[], file?: string) {
  const parse = (line: string) => {
    const suffix = PM_SUFFIX.exec(line);
    if (suffix) return { t: suffix[1], c: suffix[2] === '+', prefix: false };
    const prefix = PM_PREFIX.exec(line);
    return prefix ? { t: prefix[2], c: prefix[1] === '+', prefix: true } : null;
  };
  for (let i = 0; i < lines.length; i++) {
    if (used[i] || isBlank(lines[i]) || SEPARATOR.test(lines[i]) || parse(lines[i])) continue;
    let cursor = i;
    const stem: string[] = [];
    while (cursor < lines.length && cursor - i < 4 && !isBlank(lines[cursor]) && !SEPARATOR.test(lines[cursor]) && !parse(lines[cursor])) {
      stem.push(lines[cursor].trim());
      cursor++;
    }
    if (isBlank(lines[cursor])) cursor++;
    const answers: { t: string; c: boolean; prefix: boolean }[] = [];
    let j = cursor;
    for (; j < lines.length; j++) {
      const answer = parse(lines[j]);
      if (answer) answers.push(answer);
      else if (!isBlank(lines[j]) || !answers.length || !parse(lines[j + 1] ?? '')) break;
    }
    const hasBoth = answers.some((a) => a.c) && answers.some((a) => !a.c);
    if (answers.length < 2 || !answers.some((a) => a.c) || (answers[0].prefix && !hasBoth)) continue;
    drafts.push({
      front: stem.join(' ').replace(/^\d{1,3}\s*[.)]\s*/, ''),
      back: answers.filter((a) => a.c).map((a) => a.t).join('\n'),
      type: 'mcq',
      file,
      answers: answers.map(({ t, c }) => ({ t, c })),
    });
    used.fill(true, i, j);
    i = j - 1;
  }
}

/** "zad 1 (4 pkt)" on its own line, with the task on the following lines. */
function takeTaskHeaders(lines: string[], used: boolean[], drafts: Draft[], file?: string) {
  for (let i = 0; i < lines.length; i++) {
    if (used[i] || !TASK_HEADER.test(lines[i])) continue;
    let j = i + 1;
    const body: string[] = [];
    while (j < lines.length && !isBlank(lines[j]) && !TASK_HEADER.test(lines[j]) && body.length < 12) {
      body.push(lines[j].trim());
      j++;
    }
    if (!body.length) continue;
    drafts.push({ front: body.join(' '), back: '', type: 'open', file });
    used.fill(true, i, j);
    i = j - 1;
  }
}

function clozeCards(lines: string[], used: boolean[], file?: string): Draft[] {
  const text = lines.filter((_, i) => !used[i]).join(' ');
  const drafts: Draft[] = [];
  for (const sentence of text.match(/[^.!?]{40,220}[.!?]/g) ?? []) {
    if (CODE_LIKE.test(sentence)) continue;
    const words = sentence.trim().split(/\s+/);
    if (words.length < 8) continue;
    const pick = words
      .map((word, index) => ({ word: word.replace(/[^\p{L}\p{N}-]/gu, ''), index }))
      .filter(({ word, index }) => index > 0 && (word.length >= 8 || /^\d{2,}$/.test(word) || /^\p{Lu}{2,}$/u.test(word)))
      .sort((a, b) => b.word.length - a.word.length)[0];
    if (!pick) continue;
    const front = words.map((word, index) => (index === pick.index ? word.replace(pick.word, '_____') : word)).join(' ');
    drafts.push({ front, back: pick.word, type: 'cloze', file });
  }
  return drafts;
}

function dedupe(drafts: Draft[]): Draft[] {
  const seen = new Set<string>();
  return drafts.filter((draft) => {
    draft.front = draft.front.replace(/^[\s.,;:)\]-]+/, '').trim();
    const key = normalizeAnswer(draft.front);
    if (key.length < 3 || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
