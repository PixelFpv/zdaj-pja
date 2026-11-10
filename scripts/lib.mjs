/** Helpers shared by the sync script, the issue actions and the tests. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const MATERIAL_CATS = ['exam', 'colloquium', 'lecture', 'lab', 'other'];
const MAX_ATTACHMENTS = 20;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const ATTACHMENT_URL = /^https:\/\/github\.com\/user-attachments\/(?:files|assets)\/[\w./%-]+$/;
const COURSE_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const CONTENT_TYPE_EXT = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'text/plain': 'txt' };

/** Allowed uploads and the leading bytes each must have, so a renamed program is rejected. */
const startsWith = (...signature) => (b) => signature.every((value, i) => b[i] === value);
const notBinary = (b) => !b.subarray(0, 8192).includes(0);
const OOXML = startsWith(0x50, 0x4b, 0x03, 0x04);
const OLE = startsWith(0xd0, 0xcf, 0x11, 0xe0);
const JPEG = startsWith(0xff, 0xd8, 0xff);
const MATERIAL_TYPES = {
  pdf: startsWith(0x25, 0x50, 0x44, 0x46),
  docx: OOXML, pptx: OOXML, odt: OOXML,
  doc: OLE, ppt: OLE,
  rtf: startsWith(0x7b, 0x5c, 0x72, 0x74, 0x66),
  txt: notBinary, md: notBinary,
  png: startsWith(0x89, 0x50, 0x4e, 0x47),
  jpg: JPEG, jpeg: JPEG,
};

/** Reads course, category and GitHub attachment links from a "share materials" issue. */
export function parseMaterialIssue(body) {
  const text = body ?? '';
  const courseId = /^course:\s*(\S+)\s*$/m.exec(text)?.[1];
  const category = /^category:\s*(\S+)\s*$/m.exec(text)?.[1];
  if (!COURSE_ID.test(courseId ?? '')) throw new Error('Invalid course.');
  if (!MATERIAL_CATS.includes(category)) throw new Error('Invalid category.');

  const found = new Map();
  const add = (name, url) => {
    if (ATTACHMENT_URL.test(url) && !found.has(url)) found.set(url, name || url.split('/').pop());
  };
  for (const m of text.matchAll(/!?\[([^\]]*)\]\((https:[^\s)]+)\)/g)) add(m[1], m[2]);
  for (const m of text.matchAll(/<img\b[^>]*>/gi)) {
    const src = /\bsrc="([^"]+)"/.exec(m[0])?.[1];
    if (src) add(/\balt="([^"]*)"/.exec(m[0])?.[1], src);
  }
  if (!found.size) throw new Error('No attached files found.');
  if (found.size > MAX_ATTACHMENTS) throw new Error(`At most ${MAX_ATTACHMENTS} files per issue.`);
  return { courseId, category, attachments: [...found].map(([url, name]) => ({ url, name })) };
}

/** Builds a file name that cannot leave its folder and has an allowed extension. */
export function safeMaterialName(name, contentType) {
  let base = String(name).split(/[\\/]/).pop().normalize('NFC')
    .replace(/[^\p{L}\p{N}._ -]/gu, '_').replace(/^[.\s]+/, '').trim().slice(-120);
  const ext = base.includes('.') ? base.split('.').pop().toLowerCase() : '';
  if (Object.hasOwn(MATERIAL_TYPES, ext)) return base;
  const inferred = CONTENT_TYPE_EXT[contentType];
  if (!inferred) throw new Error(`File type not allowed: ${base || 'unnamed'}`);
  base = `${base.replace(/\.$/, '') || 'plik'}.${inferred}`;
  return base;
}

const matchesType = (name, bytes) => MATERIAL_TYPES[name.split('.').pop().toLowerCase()](bytes);

/** Downloads every attachment first, so one bad file means nothing from the issue is saved. */
export async function storeMaterials(body, root, fetchImpl = fetch) {
  const { courseId, category, attachments } = parseMaterialIssue(body);
  const downloads = [];
  for (const { url, name } of attachments) {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Could not download ${name} (HTTP ${response.status}).`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > MAX_ATTACHMENT_BYTES) throw new Error(`${name} is larger than 25 MB.`);
    const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim();
    const safeName = safeMaterialName(name, contentType);
    if (!matchesType(safeName, bytes)) throw new Error(`${safeName}: content does not match its file type.`);
    downloads.push({ safeName, bytes });
  }

  const dir = join(root, 'content', 'materials', courseId, category);
  mkdirSync(dir, { recursive: true });
  let added = 0;
  for (const { safeName, bytes } of downloads) {
    const digest = createHash('sha1').update(bytes).digest('hex').slice(0, 8);
    let target = join(dir, safeName);
    if (existsSync(target)) {
      if (createHash('sha1').update(readFileSync(target)).digest('hex').startsWith(digest)) continue;
      const dot = safeName.lastIndexOf('.');
      target = join(dir, `${safeName.slice(0, dot)}-${digest}${safeName.slice(dot)}`);
      if (existsSync(target)) continue;
    }
    writeFileSync(target, bytes);
    added += 1;
  }
  return { courseId, category, added };
}

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
