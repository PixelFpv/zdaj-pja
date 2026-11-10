#!/usr/bin/env node
/**
 * Builds public/data from the upstream sources:
 *   - bibixx/zdaj-se-pjatk-data  question banks (CC BY-SA 4.0) + override patches + images
 *   - bibixx/zdaj-se-pjatk-files manifest of study materials (files stay on GitHub)
 *   - PixelFpv/PPJ-Quiz          PPJ question bank
 *   - content/questions/*.json   questions added through this site
 * and merges them into one catalog of courses.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { categorize, isUsable, MATERIAL_CATS, parsePpjQuestions } from './lib.mjs';
import { ARCHIVE_NAMES, canonicalCode, PROGRAM, PROGRAM_URL } from './program.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.cache');
const OUT = join(ROOT, 'public', 'data');
const FILES_MANIFEST = 'https://zdaj-se-pjatk-files.bibixx.workers.dev/files.min.json';

/** Question bank id -> course code. Banks missing here become standalone courses. */
const BANK_COURSE = {
  abd: 'ABD', asd: 'ASD', aug: 'AUG', bsi: 'BSI', bsi_ang_2012: 'BSI', bsi_ang_2018: 'BSI',
  fiz: 'FIZ', fizk1: 'FIZ', fizk2: 'FIZ', grk: 'GRK', mad: 'MAD', mad1: 'MAD', mad2012a: 'MAD',
  mas: 'MAS', ppb_ang: 'PPB', rbd: 'RBD', rbdz: 'RBD', rpg: 'RPG', sbd: 'SBD', sbd2015: 'SBD',
  modeling_and_analysis_of_it_systems: 'MAS', 'prawne_aspekty_zarządzania': 'PAZ', hur: 'HUR', apbd: 'APBD', wsi: 'WSI',
  skj: 'SKJ', 'sko1-skj': 'SKJ', sko2: 'SKO2', sop: 'SOP', tak: 'TAK', tak_ang: 'TAK', tin: 'TIN', zpr: 'ZPR',
};

const OFFICIAL = new Map(
  Object.entries(PROGRAM).flatMap(([sem, list]) => list.map(([code, name, elective]) => [code, { sem, name, elective: !!elective }])),
);

function run(cmd, args, cwd) {
  execFileSync(cmd, args, { cwd, stdio: ['ignore', 'ignore', 'inherit'] });
}

function checkout(name, url) {
  const dir = join(CACHE, name);
  if (existsSync(join(dir, '.git'))) {
    run('git', ['fetch', '--depth', '1', 'origin', 'HEAD'], dir);
    run('git', ['reset', '--hard', 'FETCH_HEAD'], dir);
  } else {
    mkdirSync(CACHE, { recursive: true });
    run('git', ['clone', '--depth', '1', url, dir]);
  }
  return dir;
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const hash = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);
const write = (rel, value) => {
  const p = join(OUT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(value));
};

/** Applies upstream's per-question patches, mirroring its own implodeOverrides step. */
function applyPatches(subject, patchDir) {
  if (!existsSync(patchDir)) return subject;
  const byId = new Map(subject.data.map((q, i) => [String(q.id), i]));
  const data = [...subject.data];
  let title = subject.title;
  for (const file of readdirSync(patchDir).sort()) {
    const patch = readJson(join(patchDir, file));
    if (file === 'index.patch.json') {
      title = patch.title ?? title;
      continue;
    }
    const index = patch.id === undefined || patch.id === null ? undefined : byId.get(String(patch.id));
    if (index === undefined) {
      data.push(patch);
    } else {
      const old = data[index];
      data[index] = { ...old, ...patch, id: old.id, comments: [...(old.comments ?? []), ...(patch.comments ?? [])] };
    }
  }
  return { ...subject, title, data };
}

function normalizeZdajSe(bankId, q) {
  const id = q.id ?? hash(q.question + (q.answers ?? []).map((a) => a.answer).join());
  const format = q.isMarkdown ? 'md' : 'html';
  const out = {
    id: String(id),
    q: q.question,
    f: format,
    a: (q.answers ?? []).map((a) => ({ t: a.answer, c: !!a.correct, f: a.isMarkdown ? 'md' : 'html' })),
  };
  const comments = (q.comments ?? []).filter((c) => c && c.comment);
  if (comments.length) out.cm = comments.map((c) => ({ by: c.author ?? '', t: c.comment, at: c.date ?? null }));
  return out;
}

function bankScope(id, title) {
  return /\bk[12]\b|kolos|kolok/i.test(`${id.replace(/^fiz/, 'fiz ')} ${title}`) ? 'colloquium' : 'all';
}

function flatten(node, prefix, out) {
  for (const f of node.files ?? []) out.push(prefix ? `${prefix}/${f}` : f);
  for (const [name, child] of Object.entries(node.subdirectories ?? {})) {
    flatten(child, prefix ? `${prefix}/${name}` : name, out);
  }
  return out;
}

function courseFolders(tree) {
  const found = [];
  const add = (level, sem, code, node, root) => found.push({ level, sem, code, node, root: `${root}/${code}` });
  for (const [sem, node] of Object.entries(tree.subdirectories)) {
    if (sem === 'mgr') {
      for (const [mgrSem, mgrNode] of Object.entries(node.subdirectories)) {
        for (const [code, c] of Object.entries(mgrNode.subdirectories ?? {})) {
          add('mgr', mgrSem.replace('sem', ''), code, c, `mgr/${mgrSem}`);
        }
      }
    } else {
      for (const [code, c] of Object.entries(node.subdirectories ?? {})) add('inz', sem.replace('sem', ''), code, c, sem);
    }
  }
  return found;
}

async function main() {
  const dataDir = checkout('zdaj-se-pjatk-data', 'https://github.com/bibixx/zdaj-se-pjatk-data');
  const ppjDir = checkout('PPJ-Quiz', 'https://github.com/PixelFpv/PPJ-Quiz');

  console.log('Fetching materials manifest…');
  const response = await fetch(FILES_MANIFEST);
  if (!response.ok) throw new Error(`Materials manifest: HTTP ${response.status}`);
  const tree = await response.json();

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const courses = new Map();
  const ensure = (rawCode, init = {}) => {
    const code = canonicalCode(rawCode);
    const id = code.toLowerCase();
    if (!courses.has(id)) {
      const official = OFFICIAL.get(code);
      courses.set(id, {
        id, code, level: 'inz', sem: official?.sem ?? null, official: !!official, elective: official?.elective ?? false,
        banks: [], files: null, ...init, name: official?.name ?? ARCHIVE_NAMES[code] ?? init.name ?? '',
      });
    }
    return courses.get(id);
  };
  for (const code of OFFICIAL.keys()) ensure(code);
  /** Content files may still use an old course code. */
  const courseFor = (id, name) => ensure(id.toUpperCase(), { name: name ?? '' });

  const folders = new Map();
  for (const { level, sem, code, node, root } of courseFolders(tree)) {
    const course = ensure(code);
    if (!course.official) Object.assign(course, { level, sem: level === 'mgr' ? sem : null });
    const relative = flatten(node, '', []);
    const entry = folders.get(course.id) ?? { course, seen: new Set(), files: [] };
    folders.set(course.id, entry);
    // Some folders are exact copies under an old code; list them only once.
    if (relative.length && relative.every((p) => entry.seen.has(p))) continue;
    for (const p of relative) {
      entry.seen.add(p);
      entry.files.push([`${root}/${p}`, categorize(`${root}/${p}`)]);
    }
  }
  for (const { course, files } of folders.values()) {
    const counts = { exam: 0, colloquium: 0, lecture: 0, lab: 0, other: 0, total: files.length, usable: 0 };
    for (const [p, cat] of files) {
      counts[cat] += 1;
      if (isUsable(p)) counts.usable += 1;
    }
    course.files = counts;
    write(`files/${course.id}.json`, files);
  }

  // Question banks from zdaj-se-pjatk
  const index = readJson(join(dataDir, 'index.json'));
  const rootPatch = join(dataDir, 'overrides', 'patches', 'index.patch.json');
  const titles = new Map(existsSync(rootPatch) ? readJson(rootPatch).pages.map((p) => [p.id, p.title]) : []);
  let totalQuestions = 0;

  for (const page of index.pages) {
    const file = join(dataDir, `${page.id}.json`);
    if (!existsSync(file)) continue;
    const subject = applyPatches(readJson(file), join(dataDir, 'overrides', 'patches', page.id));
    const title = titles.get(page.id) ?? subject.title ?? page.title;
    const questions = subject.data.map((q) => normalizeZdajSe(page.id, q));
    const code = BANK_COURSE[page.id];
    const course = code ? ensure(code) : ensure(page.id.toUpperCase(), { name: title });
    if (!course.name) course.name = title.replace(/\s*[-–(].*$/, '');
    course.banks.push({ id: page.id, title, count: questions.length, scope: bankScope(page.id, title), source: 'zdajse' });
    write(`banks/${page.id}.json`, questions);
    totalQuestions += questions.length;
  }

  // PPJ-Quiz
  const ppj = parsePpjQuestions(readFileSync(join(ppjDir, 'questions.js'), 'utf8')).map((q) => ({
    id: q.id,
    q: q.q,
    f: 'text',
    code: q.code || undefined,
    why: q.why || undefined,
    tags: [q.category, q.source === 'canonical' ? 'kanoniczne' : 'dodatkowe'],
    a: q.opts.map((t, i) => ({ t, c: i === q.a, f: 'text' })),
  }));
  ensure('PPJ').banks.push({ id: 'ppj-quiz', title: 'PPJ Quiz', count: ppj.length, scope: 'exam', source: 'ppj', url: 'https://ppj.p1xel.pl' });
  write('banks/ppj-quiz.json', ppj);
  totalQuestions += ppj.length;

  // Questions shared through this site (see scripts/apply-issue.mjs)
  const contentDir = join(ROOT, 'content', 'questions');
  if (existsSync(contentDir)) {
    for (const file of readdirSync(contentDir).filter((f) => f.endsWith('.json'))) {
      const { courseId, courseName, questions } = readJson(join(contentDir, file));
      if (!questions?.length) continue;
      const course = courseFor(courseId, courseName);
      const bankId = `community-${course.id}`;
      course.banks.push({ id: bankId, title: 'Społeczność', count: questions.length, scope: 'all', source: 'community' });
      write(`banks/${bankId}.json`, questions);
      totalQuestions += questions.length;
    }
  }

  // Questions extracted from the study materials; most have no answer key.
  const minedDir = join(ROOT, 'content', 'mined');
  if (existsSync(minedDir)) {
    for (const file of readdirSync(minedDir).filter((f) => f.endsWith('.json'))) {
      const { courseId, questions } = readJson(join(minedDir, file));
      if (!questions?.length) continue;
      const course = courseFor(courseId);
      const bankId = `mined-${course.id}`;
      course.banks.push({ id: bankId, title: 'Z materiałów', count: questions.length, scope: 'all', source: 'mined' });
      write(`banks/${bankId}.json`, questions);
      totalQuestions += questions.length;
    }
  }

  // Materials added through this site. Only listed here; the browser fetches them from the repo.
  const materialsDir = join(ROOT, 'content', 'materials');
  if (existsSync(materialsDir)) {
    for (const courseId of readdirSync(materialsDir)) {
      const own = MATERIAL_CATS.flatMap((cat) => {
        const dir = join(materialsDir, courseId, cat);
        return existsSync(dir) ? readdirSync(dir).map((name) => [`@own/${cat}/${name}`, cat]) : [];
      });
      if (!own.length) continue;
      const course = courseFor(courseId);
      const listPath = join(OUT, 'files', `${course.id}.json`);
      const existing = existsSync(listPath) ? readJson(listPath) : [];
      const counts = course.files ?? { exam: 0, colloquium: 0, lecture: 0, lab: 0, other: 0, total: 0, usable: 0 };
      for (const [path, cat] of own) {
        counts[cat] += 1;
        counts.total += 1;
        if (isUsable(path)) counts.usable += 1;
      }
      course.files = counts;
      write(`files/${course.id}.json`, [...own, ...existing]);
    }
  }

  const list = [...courses.values()].sort((a, b) => a.code.localeCompare(b.code));
  write('catalog.json', { generatedAt: Date.now(), programUrl: PROGRAM_URL, courses: list });

  cpSync(join(dataDir, 'images'), join(OUT, 'images'), { recursive: true });
  console.log(`Done: ${list.length} courses, ${totalQuestions} questions.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
