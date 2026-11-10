import { unzipSync, strFromU8 } from 'fflate';

const MAX_PDF_PAGES = 250;

export const extensionOf = (name: string) => (name.split('.').pop() ?? '').toLowerCase();

const TEXT = new Set(['txt', 'md', 'csv']);
const HTML = new Set(['html', 'htm', 'mht']);
const OPENXML = new Set(['docx', 'pptx']);
const OPENDOC = new Set(['odt', 'sxw']);
const LEGACY = new Set(['doc', 'ppt', 'pps']);
const IMAGE = new Set(['jpg', 'jpeg', 'png', 'bmp']);

export const isImage = (name: string) => IMAGE.has(extensionOf(name));
/** Files whose text can be pulled out in the browser. */
export const isExtractable = (name: string) => {
  // "~$name.docx" files are Word lock files that were committed by accident.
  if (name.split('/').pop()!.startsWith('~$')) return false;
  const ext = extensionOf(name);
  return TEXT.has(ext) || HTML.has(ext) || OPENXML.has(ext) || OPENDOC.has(ext) || LEGACY.has(ext) || IMAGE.has(ext) || ext === 'pdf' || ext === 'rtf';
};

/** Rank for automatic selection: cleanest formats first, OCR last. */
export function formatRank(name: string): number {
  const ext = extensionOf(name);
  if (TEXT.has(ext) || OPENXML.has(ext) || OPENDOC.has(ext)) return 0;
  if (ext === 'pdf' || HTML.has(ext) || ext === 'rtf') return 1;
  if (LEGACY.has(ext)) return 2;
  return 3;
}

function decode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1250').decode(bytes);
  }
}

function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,noscript').forEach((el) => el.remove());
  doc.querySelectorAll('br,p,div,li,tr,h1,h2,h3,h4,h5,h6,pre').forEach((el) => el.append('\n'));
  return doc.body?.textContent ?? '';
}

function rtfToText(rtf: string): string {
  return rtf
    .replace(/\\'([0-9a-f]{2})/gi, (_, hex: string) => new TextDecoder('windows-1250').decode(new Uint8Array([parseInt(hex, 16)])))
    .replace(/\\u(-?\d+)\??/g, (_, code: string) => String.fromCharCode((Number(code) + 65536) % 65536))
    .replace(/\\(?:par|line)\b/g, '\n')
    .replace(/\{\\(?:fonttbl|colortbl|stylesheet|info|\*)[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '')
    .replace(/\\[a-z]+-?\d* ?/gi, '')
    .replace(/[{}]/g, '');
}

const decodeEntities = (s: string) =>
  s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, (_, e: string) => {
    const named: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
    if (named[e.toLowerCase()]) return named[e.toLowerCase()];
    return String.fromCodePoint(e[1]?.toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
  });

function xmlParagraphs(xml: string, paragraph: string, run: string): string {
  const paragraphs = xml.split(new RegExp(`</${paragraph}>`));
  const runRe = new RegExp(`<${run}(?: [^>]*)?>([^<]*)</${run}>`, 'g');
  return paragraphs
    .map((p) => {
      let text = '';
      for (const m of p.matchAll(runRe)) text += m[1];
      return decodeEntities(text);
    })
    .join('\n');
}

function openXmlToText(buffer: ArrayBuffer, ext: string): string {
  const files = unzipSync(new Uint8Array(buffer));
  if (ext === 'docx') return xmlParagraphs(strFromU8(files['word/document.xml']), 'w:p', 'w:t');
  const slides = Object.keys(files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => Number(/\d+/.exec(a)?.[0]) - Number(/\d+/.exec(b)?.[0]));
  return slides.map((f) => xmlParagraphs(strFromU8(files[f]), 'a:p', 'a:t')).join('\n\n');
}

function openDocToText(buffer: ArrayBuffer): string {
  const files = unzipSync(new Uint8Array(buffer));
  const xml = strFromU8(files['content.xml']);
  return decodeEntities(xml.replace(/<\/text:(?:p|h)>/g, '\n').replace(/<[^>]+>/g, ''));
}

/**
 * Old binary Office files have no simple text layer, so this scans for runs of
 * readable UTF-16 and CP1250 text. It is best effort; the user reviews the result.
 */
export function legacyOfficeToText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const pieces: { at: number; text: string }[] = [];
  const readable = /^[\p{L}\p{N}\p{P}\p{S}\s]+$/u;
  const noise = /Microsoft|Times New Roman|Arial|Normal\.dot|WordDocument|SummaryInformation|Calibri|Symbol|Wingdings|Courier New|CompObj|Domyślna|Default Paragraph/i;
  const accept = (at: number, text: string, min: number) => {
    const clean = text.replace(/\r/g, '\n').replace(/\u0007/g, ' ').trim();
    const letters = (clean.match(/\p{L}/gu) ?? []).length;
    if (clean.length >= min && letters / clean.length > 0.6 && readable.test(clean) && !noise.test(clean)) {
      pieces.push({ at, text: clean });
    }
  };

  let start = -1;
  let run = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8);
    const good = code === 13 || code === 9 || code === 7 || (code >= 32 && code < 127) || (code >= 0xa0 && code < 0x250) || (code >= 0x2010 && code <= 0x2026);
    if (good) {
      if (start < 0) start = i;
      run += String.fromCharCode(code);
    } else {
      if (start >= 0) accept(start, run, 8);
      start = -1;
      run = '';
    }
  }
  if (start >= 0) accept(start, run, 8);

  const cp1250 = new TextDecoder('windows-1250');
  start = -1;
  for (let i = 0; i <= bytes.length; i++) {
    const b = bytes[i];
    const good = i < bytes.length && (b === 13 || b === 9 || b === 7 || (b >= 32 && b < 127) || (b >= 0xa1 && b !== 0xff));
    if (good) {
      if (start < 0) start = i;
    } else {
      if (start >= 0 && i - start >= 24) accept(start, cp1250.decode(bytes.subarray(start, i)), 24);
      start = -1;
    }
  }

  return pieces.sort((a, b) => a.at - b.at).map((p) => p.text).join('\n');
}

async function pdfToText(buffer: ArrayBuffer, onProgress?: (fraction: number) => void): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages = Math.min(doc.numPages, MAX_PDF_PAGES);
  const parts: string[] = [];
  for (let n = 1; n <= pages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    let line = '';
    const lines: string[] = [];
    for (const item of content.items) {
      if (!('str' in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = '';
      }
    }
    if (line) lines.push(line);
    parts.push(lines.join('\n'));
    onProgress?.(n / pages);
  }
  await doc.destroy();
  return parts.join('\n\n');
}

async function ocr(blob: Blob, onProgress?: (fraction: number) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(['pol', 'eng'], 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress);
    },
  });
  try {
    const result = await worker.recognize(blob);
    return result.data.text;
  } finally {
    await worker.terminate();
  }
}

export async function extractText(name: string, buffer: ArrayBuffer, onProgress?: (fraction: number) => void): Promise<string> {
  const ext = extensionOf(name);
  if (TEXT.has(ext)) return decode(buffer);
  if (HTML.has(ext)) return htmlToText(decode(buffer));
  if (ext === 'rtf') return rtfToText(decode(buffer));
  if (OPENXML.has(ext)) return openXmlToText(buffer, ext);
  if (OPENDOC.has(ext)) return openDocToText(buffer);
  if (LEGACY.has(ext)) return legacyOfficeToText(buffer);
  if (ext === 'pdf') return pdfToText(buffer, onProgress);
  if (IMAGE.has(ext)) return ocr(new Blob([buffer]), onProgress);
  throw new Error('unsupported');
}
