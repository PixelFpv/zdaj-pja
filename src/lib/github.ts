import type { Course, MaterialCat, RawQuestion } from '../types';

export const REPO: string = import.meta.env.VITE_GITHUB_REPO || 'PixelFpv/zdaj-pja';
const MATERIALS_REPO = 'bibixx/zdaj-se-pjatk-files';
const MATERIALS_BRANCH = 'main';
/** Browsers and GitHub reject much longer prefilled URLs. */
const MAX_URL = 7500;

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

/** Materials added through this site are listed with this prefix and live in this repo. */
const OWN_PREFIX = '@own/';
export const isOwnMaterial = (path: string) => path.startsWith(OWN_PREFIX);

type MaterialCourse = Pick<Course, 'id'>;

function locate(course: MaterialCourse, path: string) {
  return isOwnMaterial(path)
    ? { repo: REPO, ref: 'HEAD', file: `content/materials/${course.id}/${path.slice(OWN_PREFIX.length)}` }
    : { repo: MATERIALS_REPO, ref: MATERIALS_BRANCH, file: path };
}

export function rawUrl(course: MaterialCourse, path: string) {
  const { repo, ref, file } = locate(course, path);
  return `https://raw.githubusercontent.com/${repo}/${ref}/${encodePath(file)}`;
}

export function viewUrl(course: MaterialCourse, path: string) {
  const { repo, ref, file } = locate(course, path);
  return `https://github.com/${repo}/blob/${ref}/${encodePath(file)}`;
}

/** The folder shown before a file name; own materials are marked with a tag instead. */
export const materialDir = (path: string) =>
  isOwnMaterial(path) ? '' : path.slice(0, path.lastIndexOf('/') + 1).replace(/^(?:mgr\/)?[^/]+\/[^/]+\//, '');

export function materialIssueUrl(courseId: string, category: MaterialCat, instructions: string) {
  const title = `[material] ${courseId}: ${category}`;
  const body = `<!-- zdaj-pja:add-material -->\n\`\`\`\ncourse: ${courseId}\ncategory: ${category}\n\`\`\`\n\n${instructions}\n\n`;
  return `https://github.com/${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

export const pendingMaterialsUrl = () =>
  `https://github.com/${REPO}/issues?q=${encodeURIComponent('is:issue is:open "[material]" in:title')}`;

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
