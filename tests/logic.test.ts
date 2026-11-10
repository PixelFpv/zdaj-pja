import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { categorize, mergeQuestions, parseIssueBody, parsePpjQuestions } from '../scripts/lib.mjs';
import { generateCards } from '../src/lib/generate';
import { parseImport } from '../src/lib/importText';
import { grade, nextCardId, newState } from '../src/lib/srs';
import { answersMatch } from '../src/lib/text';

const DAY = 86_400_000;
const hash = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 12);

describe('srs', () => {
  it('walks through learning steps and graduates', () => {
    const now = 1_000_000;
    const first = grade(undefined, 3, now);
    expect(first.step).toBe(1);
    const second = grade(first, 3, now);
    expect(second.step).toBe(-1);
    expect(second.interval).toBe(1);
    expect(second.due).toBe(now + DAY);
  });

  it('grows intervals and handles a lapse', () => {
    let s = { ...newState(0), step: -1, interval: 10 };
    s = grade(s, 3, 0);
    expect(s.interval).toBe(25);
    const lapsed = grade(s, 1, 0);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.ease).toBeCloseTo(2.3);
    expect(lapsed.step).toBeGreaterThanOrEqual(0);
  });

  it('prefers due cards, then new ones within the limit', () => {
    const states = { a: { ...newState(0), step: -1, due: 500 }, b: { ...newState(0), step: -1, due: 5000 } };
    expect(nextCardId(['b', 'c', 'a'], states, 5, 1000)).toBe('a');
    expect(nextCardId(['b', 'c'], states, 5, 1000)).toBe('c');
    expect(nextCardId(['b', 'c'], states, 0, 1000)).toBeNull();
  });
});

describe('answersMatch', () => {
  it('ignores case, diacritics and small typos', () => {
    expect(answersMatch('Żółć', 'zolc')).toBe(true);
    expect(answersMatch('Transakcja', 'transakcia')).toBe(true);
    expect(answersMatch('tak', 'nie')).toBe(false);
  });
});

describe('generateCards', () => {
  it('reads the +/- answer format from PJATK notes', () => {
    const cards = generateCards('Komputer Eniac\nbył lampowy +\nmiał assembler -\n=====\nAby użyć rekursji używa się\nbuforów -\nstosu +\n');
    expect(cards).toHaveLength(2);
    expect(cards[0].front).toBe('Komputer Eniac');
    expect(cards[0].answers).toEqual([{ t: 'był lampowy', c: true }, { t: 'miał assembler', c: false }]);
    expect(cards[1].back).toBe('stosu');
  });

  it('reads lettered options with an answer key', () => {
    const [card] = generateCards('1. Ile to 2+2?\na) 3\nb) 4\nc) 5\nOdp: b\n');
    expect(card.type).toBe('mcq');
    expect(card.answers?.filter((a) => a.c)).toEqual([{ t: '4', c: true }]);
  });

  it('keeps questions without a key as open cards', () => {
    const [card] = generateCards('1. Wyjaśnij pojęcie normalizacji.\n\n2. Co to jest indeks?\n');
    expect(card.type).toBe('open');
    expect(card.back).toBe('');
  });

  it('pairs numbered tasks with code answers after a blank line', () => {
    const cards = generateCards('2. Sprawdzić ilu podwładnych ma każdy kierownik.\n\nSELECT mgr, COUNT(*)\nFROM emp\nGROUP BY mgr;\n\n3. Wypisać działy.\n\nSELECT deptno FROM emp;\n');
    expect(cards).toHaveLength(2);
    expect(cards[0].back).toContain('GROUP BY mgr;');
  });

  it('reads task headers', () => {
    const [card] = generateCards('zad 1 (4 pkt)\nnapisz program sumujacy liczby.\nprogram konczy przy 23.\nZad 2 (9 pkt)\nNapisać program.\n');
    expect(card.front).toBe('napisz program sumujacy liczby. program konczy przy 23.');
  });

  it('finds definitions and outlines, and skips code', () => {
    const cards = generateCards('Normalizacja - proces porządkowania danych w bazie.\n\nCechy transakcji:\n- atomowość\n- trwałość\n\nint x = 5 - to zmienna typu calkowitego;\n');
    expect(cards.map((c) => c.type)).toEqual(['definition', 'outline']);
  });
});

describe('parseImport', () => {
  it('parses every supported format', () => {
    expect(parseImport('[{"front":"a","back":"b"}]')[0]).toMatchObject({ front: 'a', back: 'b' });
    expect(parseImport('```json\n[{"question":"q","answers":[{"text":"x","correct":true}]}]\n```')[0].back).toBe('x');
    expect(parseImport('front\tback\nf2\tb2')).toHaveLength(2);
    expect(parseImport('front :: back')[0].back).toBe('back');
    expect(parseImport('Q?\n- no\n+ yes\n\nQ2?\n+ a\n- b')).toHaveLength(2);
    expect(parseImport('Port?\n- 80\n+ 443\n\nACID :: Atomicity')[1]).toMatchObject({ front: 'ACID', back: 'Atomicity' });
  });
});

describe('sync helpers', () => {
  it('categorizes material paths', () => {
    expect(categorize('1sem/AM1/egzaminy/x.jpg')).toBe('exam');
    expect(categorize('1sem/PPJ/kolokwia/PPJ_k_2013.pdf')).toBe('colloquium');
    expect(categorize('3sem/ASD/wyklady/w1.pdf')).toBe('lecture');
    expect(categorize('3sem/ASD/inne/x.pdf')).toBe('other');
  });

  it('reads PPJ-Quiz data without evaluating it', () => {
    const list = parsePpjQuestions('/* c */ const DB = [{"id":"S1","q":"t","opts":["a","b"],"a":1}];');
    expect(list[0].id).toBe('S1');
    expect(() => parsePpjQuestions('const DB = [alert(1)];')).toThrow();
  });
});

describe('issue intake', () => {
  const body = (payload: unknown) => `x\n\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``;
  const valid = { courseId: 'sbd', questions: [{ q: 'Q', a: [{ t: 'A', c: true }, { t: 'B', c: false }] }] };

  it('accepts a valid issue and drops unknown fields', () => {
    const parsed = parseIssueBody(body({ ...valid, questions: [{ ...valid.questions[0], evil: 1 }] }));
    expect(parsed.questions[0]).not.toHaveProperty('evil');
  });

  it('rejects path traversal and questions without a correct answer', () => {
    expect(() => parseIssueBody(body({ ...valid, courseId: '../../x' }))).toThrow();
    expect(() => parseIssueBody(body({ courseId: 'a', questions: [{ q: 'Q', a: [{ t: 'A', c: false }] }] }))).toThrow();
    expect(() => parseIssueBody('no json')).toThrow();
  });

  it('skips duplicates when merging', () => {
    const incoming = parseIssueBody(body(valid));
    const first = mergeQuestions(null, incoming, hash);
    expect(first.added).toBe(1);
    const second = mergeQuestions(first.file, incoming, hash);
    expect(second.added).toBe(0);
    expect(second.file.questions).toHaveLength(1);
  });
});
