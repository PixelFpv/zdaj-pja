import type { RawQuestion } from '../types';

export const REPO: string = import.meta.env.VITE_GITHUB_REPO || 'PixelFpv/zdaj-pja';
const MATERIALS_REPO = 'bibixx/zdaj-se-pjatk-files';
const MATERIALS_BRANCH = 'main';
/** Browsers and GitHub reject much longer prefilled URLs. */
const MAX_URL = 7500;

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

export const rawUrl = (root: string, path: string) =>
  `https://raw.githubusercontent.com/${MATERIALS_REPO}/${MATERIALS_BRANCH}/${encodePath(`${root}/${path}`)}`;

export const viewUrl = (root: string, path: string) =>
  `https://github.com/${MATERIALS_REPO}/blob/${MATERIALS_BRANCH}/${encodePath(`${root}/${path}`)}`;

export interface PublishLink {
  url: string;
  /** Set when the content did not fit the URL and has to be pasted into the issue by hand. */
  clipboard?: string;
}

export function publishLink(courseId: string, courseName: string, questions: RawQuestion[]): PublishLink {
  const payload = {
    courseId,
    courseName,
    questions: questions.map(({ q, a, code, why, back, scope }) => ({ q, a, code, why, back, scope })),
  };
  const body = `<!-- zdaj-pja:add-questions -->\n\`\`\`json\n${JSON.stringify(payload, null, 1)}\n\`\`\`\n`;
  const title = `[questions] ${courseId}: +${questions.length}`;
  const base = `https://github.com/${REPO}/issues/new?title=${encodeURIComponent(title)}`;
  const url = `${base}&body=${encodeURIComponent(body)}`;
  return url.length <= MAX_URL ? { url } : { url: base, clipboard: body };
}
