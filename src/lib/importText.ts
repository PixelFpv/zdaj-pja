import type { Draft } from '../types';

/**
 * Parses text pasted by the user or returned by an AI chat. Accepts, in order:
 *  - a JSON array of {front, back} or {question, answers:[{text, correct}]}
 *  - tab-separated "front<TAB>back" lines (Quizlet / Anki export)
 *  - "front :: back" lines
 *  - blocks with "+ correct" / "- wrong" answer lines, separated by a blank line
 *  - blocks of "question" and then "answer" separated by a blank line
 */
export function parseImport(input: string): Draft[] {
  const text = input.trim();
  if (!text) return [];
  return parseJson(text) ?? parseLines(text) ?? parseBlocks(text);
}

function stripFence(text: string): string {
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  return fence ? fence[1].trim() : text;
}

function parseJson(text: string): Draft[] | null {
  const body = stripFence(text);
  if (!/^[[{]/.test(body)) return null;
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return null;
  }
  const list = Array.isArray(value) ? value : (value as { cards?: unknown[] }).cards;
  if (!Array.isArray(list)) return null;
  const drafts: Draft[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const front = String(item.front ?? item.question ?? item.q ?? '').trim();
    if (!front) continue;
    if (Array.isArray(item.answers)) {
      const answers = item.answers
        .map((a) => {
          const answer = a as Record<string, unknown>;
          return { t: String(answer.text ?? answer.t ?? answer.answer ?? '').trim(), c: !!(answer.correct ?? answer.c) };
        })
        .filter((a) => a.t);
      if (answers.length) {
        drafts.push({ front, back: answers.filter((a) => a.c).map((a) => a.t).join('\n'), type: 'mcq', answers });
        continue;
      }
    }
    drafts.push({ front, back: String(item.back ?? item.answer ?? item.a ?? '').trim(), type: 'qa' });
  }
  return drafts;
}

function parseLines(text: string): Draft[] | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const split = (line: string) => {
    const tab = line.indexOf('\t');
    if (tab > 0) return [line.slice(0, tab), line.slice(tab + 1)];
    const separator = line.indexOf('::');
    return separator > 0 ? [line.slice(0, separator), line.slice(separator + 2)] : null;
  };
  const pairs = lines.map(split);
  if (pairs.some((p) => !p || !p[0].trim() || !p[1].trim())) return null;
  return (pairs as string[][]).map(([front, back]) => ({ front: front.trim(), back: back.trim(), type: 'qa' }));
}

function parseBlocks(text: string): Draft[] {
  const answerLine = /^\s*([+\-*])\s+(.+)$/;
  const drafts: Draft[] = [];
  for (const block of text.split(/\r?\n\s*\r?\n/)) {
    const lines = block.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) continue;
    const firstAnswer = lines.findIndex((l) => answerLine.test(l));
    const pair = lines.length === 1 ? /^(.+?)(?:\t|\s*::\s*)(.+)$/.exec(lines[0]) : null;
    if (pair) {
      drafts.push({ front: pair[1].trim(), back: pair[2].trim(), type: 'qa' });
    } else if (firstAnswer > 0) {
      const answers = lines.slice(firstAnswer).flatMap((line) => {
        const m = answerLine.exec(line);
        return m ? [{ t: m[2].trim(), c: m[1] !== '-' }] : [];
      });
      const front = lines.slice(0, firstAnswer).join('\n').trim();
      drafts.push({ front, back: answers.filter((a) => a.c).map((a) => a.t).join('\n'), type: 'mcq', answers });
    } else {
      drafts.push({ front: lines[0].trim(), back: lines.slice(1).join('\n').trim(), type: 'qa' });
    }
  }
  return drafts;
}

export const AI_PROMPT = `Na podstawie poniższego materiału ze studiów przygotuj fiszki do nauki.
Zasady: jedna informacja na fiszkę, pytania konkretne, odpowiedzi krótkie, tylko fakty z materiału. Zachowaj język materiału.
Zwróć WYŁĄCZNIE tablicę JSON w formacie:
[{"front":"pytanie","back":"odpowiedź"}]
Dla pytań testowych użyj formatu:
{"question":"treść","answers":[{"text":"odpowiedź","correct":true},{"text":"odpowiedź","correct":false}]}

MATERIAŁ:
`;
