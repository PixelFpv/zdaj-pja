#!/usr/bin/env node
/** Used by .github/workflows/add-materials.yml: saves the files attached to a "share materials" issue. */
import { appendFileSync, readFileSync } from 'node:fs';
import { storeMaterials } from './lib.mjs';

const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const output = (key, value) => appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);

try {
  const { added } = await storeMaterials(event.issue.body, process.cwd());
  output('ok', 'true');
  output('added', String(added));
} catch (error) {
  console.error(error);
  output('ok', 'false');
  // JSON keeps the message on one line, and it is passed to the comment as data.
  output('error', JSON.stringify(String(error.message ?? error)));
}
