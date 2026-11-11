import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { publishLink } from '../src/lib/github';
import { categorize, detectLanguage, loadIssueQuestions, mergeQuestions, parseIssueBody, parseMaterialIssue, parsePpjQuestions, safeMaterialName, storeMaterials, tagLanguages } from '../scripts/lib.mjs';
import { trackedPath } from '../src/lib/analytics';
import { looksLikeUtf8 } from '../src/lib/extract';
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

describe('looksLikeUtf8', () => {
  it('tolerates a damaged byte in UTF-8 text but rejects CP1250 text', () => {
    expect(looksLikeUtf8('Zażółć gęślą jaźń, liczba cylindrów �')).toBe(true);
    expect(looksLikeUtf8('Za���� g��l� ja��')).toBe(false);
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

describe('trackedPath', () => {
  it('keeps course paths and real tabs, and ignores filters and the default tab', () => {
    expect(trackedPath('/c/sbd', '')).toBe('/c/sbd');
    expect(trackedPath('/c/sbd', '?tab=questions&scope=exam')).toBe('/c/sbd?tab=questions');
    expect(trackedPath('/c/sbd', '?tab=learn')).toBe('/c/sbd');
    expect(trackedPath('/c/sbd', '?scope=exam&off=bsi')).toBe('/c/sbd');
  });
});

describe('question language', () => {
  const q = (text: string, answers: string[] = []) => ({ q: text, a: answers.map((t) => ({ t })) });

  it('recognizes each language despite technical terms', () => {
    expect(detectLanguage(q('Która instrukcja SELECT zwraca rekordy z tabeli?', ['SELECT * FROM emp', 'DELETE FROM emp']))).toBe('pl');
    expect(detectLanguage(q('Which of the following statements are true?', ['SQL is a language']))).toBe('en');
    expect(detectLanguage(q('<span>What is the role of a firewall?</span>'))).toBe('en');
    expect(detectLanguage(q('SELECT 1'))).toBeNull();
    expect(detectLanguage(q('Zaznacz poprawne odpowiedzi:', ['The data is stored in the table', 'What the system has']))).toBe('pl');
    expect(detectLanguage(q('SELECT 1', ['What is the result of this query']))).toBe('en');
  });

  it('tags only English questions and resolves unclear ones by their bank', () => {
    const tagged = tagLanguages([q('What are the layers of this model?'), q('Which of these can be used?'), q('TCP/IP')]);
    expect(tagged.map((x) => x.l)).toEqual(['en', 'en', 'en']);
    const polish = tagLanguages([q('Co to jest indeks?'), q('TCP/IP')]);
    expect(polish.map((x) => x.l)).toEqual([undefined, undefined]);
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

describe('material intake', () => {
  const PDF = new TextEncoder().encode('%PDF-1.7 hello');
  const FILE_URL = 'https://github.com/user-attachments/files/123/kol.pdf';
  const IMAGE_URL = 'https://github.com/user-attachments/assets/1b2c-3d';
  const body = (attachments: string) => `<!-- zdaj-pja:add-material -->\n\`\`\`\ncourse: ppj\ncategory: colloquium\n\`\`\`\n\n${attachments}`;
  const server = (bytes: Uint8Array, type = 'application/pdf') => (async () => new Response(bytes, { headers: { 'content-type': type } })) as typeof fetch;
  const tempRoot = () => mkdtempSync(join(tmpdir(), 'zdaj-'));

  it('reads files, images and ignores links outside GitHub attachments', () => {
    const parsed = parseMaterialIssue(body(`[kol.pdf](${FILE_URL})\n<img width="10" alt="scan" src="${IMAGE_URL}">\n[x](https://evil.example/a.pdf)`));
    expect(parsed).toMatchObject({ courseId: 'ppj', category: 'colloquium' });
    expect(parsed.attachments).toEqual([{ url: FILE_URL, name: 'kol.pdf' }, { url: IMAGE_URL, name: 'scan' }]);
  });

  it('rejects bad metadata and issues with no files', () => {
    expect(() => parseMaterialIssue(body(`[a](${FILE_URL})`).replace('course: ppj', 'course: ../../x'))).toThrow();
    expect(() => parseMaterialIssue(body(`[a](${FILE_URL})`).replace('colloquium', 'secret'))).toThrow();
    expect(() => parseMaterialIssue(body('nothing'))).toThrow();
  });

  it('builds safe file names', () => {
    expect(safeMaterialName('../../evil.pdf', 'application/pdf')).toBe('evil.pdf');
    expect(safeMaterialName('.hidden.pdf', '')).toBe('hidden.pdf');
    expect(safeMaterialName('scan', 'image/png')).toBe('scan.png');
    expect(() => safeMaterialName('virus.exe', 'application/octet-stream')).toThrow();
  });

  it('saves a valid file once and keeps different files with the same name', async () => {
    const root = tempRoot();
    const input = body(`[kol.pdf](${FILE_URL})`);
    expect((await storeMaterials(input, root, server(PDF))).added).toBe(1);
    expect((await storeMaterials(input, root, server(PDF))).added).toBe(0);
    expect((await storeMaterials(input, root, server(new TextEncoder().encode('%PDF-2 other')))).added).toBe(1);
    expect(readdirSync(join(root, 'content/materials/ppj/colloquium'))).toHaveLength(2);
  });

  it('rejects a program renamed to pdf and saves nothing from that issue', async () => {
    const root = tempRoot();
    await expect(storeMaterials(body(`[kol.pdf](${FILE_URL})`), root, server(new TextEncoder().encode('MZ program')))).rejects.toThrow(/does not match/);
    expect(existsSync(join(root, 'content'))).toBe(false);
  });
});

describe('large question sets', () => {
  const FILE = 'https://github.com/user-attachments/files/987/pytania-ppj.json';
  const many = Array.from({ length: 200 }, (_, i) => ({
    id: `x${i}`, q: `Pytanie numer ${i}: co robi instrukcja nr ${i}?`, f: 'md' as const,
    a: [{ t: `Odpowiedź poprawna ${i}`, c: true, f: 'md' as const }, { t: `Odpowiedź błędna ${i}`, c: false, f: 'md' as const }],
  }));
  const served = (text: string) => (async () => new Response(text)) as typeof fetch;

  it('turns 200 questions into a file that the workflow accepts', async () => {
    const link = publishLink('ppj', 'PPJ', many, 'Drag {file} here');
    expect(link.file?.name).toBe('pytania-ppj.json');
    expect(link.url.length).toBeLessThan(7500);
    expect(decodeURIComponent(link.url)).toContain('zdaj-pja:add-questions');
    const body = `${decodeURIComponent(link.url.split('body=')[1])}\n[pytania-ppj.json](${FILE})`;
    const parsed = await loadIssueQuestions(body, served(link.file!.content));
    expect(parsed.courseId).toBe('ppj');
    expect(parsed.questions).toHaveLength(200);
  });

  it('keeps small sets inline in the issue', async () => {
    const link = publishLink('ppj', 'PPJ', many.slice(0, 2), 'Drag {file} here');
    expect(link.file).toBeUndefined();
    const parsed = await loadIssueQuestions(decodeURIComponent(link.url.split('body=')[1]), served(''));
    expect(parsed.questions).toHaveLength(2);
  });

  it('rejects missing, foreign and broken attachments', async () => {
    await expect(loadIssueQuestions('<!-- zdaj-pja:add-questions -->\nnothing', served('{}'))).rejects.toThrow(/No/);
    await expect(loadIssueQuestions('[a.json](https://evil.example/a.json)', served('{}'))).rejects.toThrow(/No/);
    await expect(loadIssueQuestions(`[a.json](${FILE})`, served('not json'))).rejects.toThrow(/not valid JSON/);
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
