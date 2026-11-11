#!/usr/bin/env node
/** Used by .github/workflows/add-questions.yml: applies a "share questions" issue to content/questions. */
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadIssueQuestions, mergeQuestions } from './lib.mjs';

const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const output = (key, value) => appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);

try {
  const incoming = await loadIssueQuestions(event.issue.body);
  const dir = join('content', 'questions');
  const path = join(dir, `${incoming.courseId}.json`);
  const existing = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
  const hash = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);
  const { file, added } = mergeQuestions(existing, incoming, hash);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
  output('ok', 'true');
  output('added', String(added));
} catch (error) {
  console.error(error);
  output('ok', 'false');
  // JSON keeps the message on one line, and it is passed to the comment as data.
  output('error', JSON.stringify(String(error.message ?? error)));
}
