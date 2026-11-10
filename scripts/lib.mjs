/** Pure helpers shared by the sync script, the issue action and the tests. */

const USABLE = /\.(txt|md|pdf|docx|pptx|odt|sxw|html?|rtf|doc|ppt|pps|mht|jpe?g|png|bmp)$/i;

export const isUsable = (path) => USABLE.test(path);

/** Classifies a material by its path. Exams win over colloquia when a path mentions both. */
export function categorize(path) {
  const p = path.toLowerCase();
  if (/egzamin|exam|_e_\d|_e\b/.test(p)) return 'exam';
  if (/kolok|kolos|sprawdzian|_k\d?_|\bkol[ _-]?\d|\/kol\d/.test(p)) return 'colloquium';
  if (/wyk[lł]ad|lecture|slajd|prezentacj|notatk|skrypt/.test(p)) return 'lecture';
  if (/[cć]wicz|laborat|laborki|\blab|zadani|projekt/.test(p)) return 'lab';
  return 'other';
}

/**
 * Reads the `DB` array out of PPJ-Quiz/questions.js. The file is parsed as JSON,
 * never evaluated, so a change in that repo cannot run code during our build.
 */
export function parsePpjQuestions(source) {
  const start = source.indexOf('[', source.indexOf('DB'));
  const end = source.lastIndexOf(']');
  if (start < 0 || end < start) throw new Error('PPJ-Quiz: DB array not found');
  const list = JSON.parse(source.slice(start, end + 1));
  for (const q of list) {
    if (!q.id || !q.q || !Array.isArray(q.opts) || !Number.isInteger(q.a)) {
      throw new Error(`PPJ-Quiz: malformed question ${JSON.stringify(q).slice(0, 80)}`);
    }
  }
  return list;
}

const LIMITS = { questions: 500, text: 20000, answers: 12 };
const SCOPES = ['all', 'colloquium', 'exam'];
const isText = (v, max = LIMITS.text) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const optionalText = (v) => v === undefined || v === null || isText(v);

/** Extracts and validates the JSON block of a "share questions" issue. Throws on anything unexpected. */
export function parseIssueBody(body) {
  const match = /```json\s*([\s\S]*?)```/.exec(body ?? '');
  if (!match) throw new Error('No ```json block found in the issue body.');
  const data = JSON.parse(match[1]);
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(data.courseId ?? '')) throw new Error('Invalid courseId.');
  if (!optionalText(data.courseName)) throw new Error('Invalid courseName.');
  if (!Array.isArray(data.questions) || !data.questions.length || data.questions.length > LIMITS.questions) {
    throw new Error(`questions must be a list of 1-${LIMITS.questions} items.`);
  }
  const questions = data.questions.map((q, i) => {
    const where = `Question ${i + 1}`;
    if (!isText(q.q)) throw new Error(`${where}: missing text.`);
    if (!optionalText(q.code) || !optionalText(q.why) || !optionalText(q.back)) throw new Error(`${where}: invalid field.`);
    if (q.scope !== undefined && !SCOPES.includes(q.scope)) throw new Error(`${where}: invalid scope.`);
    const answers = q.a ?? [];
    if (!Array.isArray(answers) || answers.length > LIMITS.answers) throw new Error(`${where}: invalid answers.`);
    if (answers.some((a) => !isText(a.t) || typeof a.c !== 'boolean')) throw new Error(`${where}: invalid answer.`);
    if (!q.back && !answers.some((a) => a.c)) throw new Error(`${where}: needs a correct answer or a back side.`);
    return {
      q: q.q,
      f: 'md',
      ...(q.code ? { code: q.code } : {}),
      ...(q.why ? { why: q.why } : {}),
      ...(q.back ? { back: q.back } : {}),
      ...(q.scope ? { scope: q.scope } : {}),
      a: answers.map((a) => ({ t: a.t, c: a.c, f: 'md' })),
    };
  });
  return { courseId: data.courseId, courseName: data.courseName ?? undefined, questions };
}

/** Adds new questions to a content file, skipping exact duplicates. Ids are derived from content. */
export function mergeQuestions(existing, incoming, hash) {
  const questions = [...(existing?.questions ?? [])];
  const known = new Set(questions.map((q) => q.id));
  let added = 0;
  for (const q of incoming.questions) {
    const id = hash(JSON.stringify([q.q, q.code ?? '', q.back ?? '', q.a.map((a) => a.t)]));
    if (known.has(id)) continue;
    known.add(id);
    questions.push({ id, ...q });
    added += 1;
  }
  return {
    file: { courseId: incoming.courseId, courseName: existing?.courseName ?? incoming.courseName, questions },
    added,
  };
}
