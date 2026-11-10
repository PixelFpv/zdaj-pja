import DOMPurify from 'dompurify';
import { marked } from 'marked';
import type { Format } from '../types';

export const IMAGE_BASE = `${import.meta.env.BASE_URL}data/images/`;

let hooked = false;
function ensureHook() {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'IMG') {
      const src = node.getAttribute('src') ?? '';
      if (src && !/^(?:https?:|data:|\/)/i.test(src)) node.setAttribute('src', IMAGE_BASE + src);
      node.setAttribute('loading', 'lazy');
      node.removeAttribute('border');
      if (!node.getAttribute('alt')) node.setAttribute('alt', '');
    }
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const cache = new Map<string, string>();

/** Every piece of question content goes through here, whatever its origin. */
export function renderRich(source: string, format: Format): string {
  const key = format + source;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  ensureHook();
  let html: string;
  if (format === 'text') html = escapeHtml(source).replace(/\n/g, '<br>');
  else if (format === 'md') html = marked.parse(source, { async: false, breaks: true }) as string;
  else html = source;
  const clean = DOMPurify.sanitize(html, { FORBID_TAGS: ['style', 'form', 'input', 'button'], FORBID_ATTR: ['style', 'width', 'height'] });
  if (cache.size > 4000) cache.clear();
  cache.set(key, clean);
  return clean;
}

const plainCache = new Map<string, string>();

export function toPlain(source: string, format: Format, imageLabel = '🖼'): string {
  if (format === 'text') return source;
  const key = format + source;
  const hit = plainCache.get(key);
  if (hit !== undefined) return hit;
  const box = document.createElement('div');
  box.innerHTML = renderRich(source, format);
  box.querySelectorAll('img').forEach((img) => img.replaceWith(imageLabel));
  box.querySelectorAll('br,p,div,li,tr').forEach((el) => el.append(' '));
  const plain = (box.textContent ?? '').replace(/\s+/g, ' ').trim();
  plainCache.set(key, plain);
  return plain;
}

export const hasImage = (source: string) => /<img|!\[/i.test(source);
