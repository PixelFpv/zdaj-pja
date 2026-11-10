import { ArrowLeft, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LoadError, Loading, Message, ProgressBar, useTitle } from '../components/Common';
import { useCourse, useMaterials } from '../data';
import { useI18n, type Key } from '../i18n';
import { extractText, formatRank, isExtractable, isImage } from '../lib/extract';
import { cleanText, generateCards } from '../lib/generate';
import { isOwnMaterial, materialDir, rawUrl } from '../lib/github';
import { AI_PROMPT, parseImport } from '../lib/importText';
import { addDeck, uid } from '../store';
import type { Draft, MaterialCat, Scope } from '../types';

const MAX_FILES = 25;
const AUTO_FILES = 10;
const AUTO_OCR = 4;
const MAX_FILE_BYTES = 30 * 1024 * 1024;
const MAX_PROMPT_CHARS = 60_000;
const CATS: (MaterialCat | 'all')[] = ['all', 'exam', 'colloquium', 'lecture', 'lab', 'other'];

interface Row extends Draft {
  key: string;
  on: boolean;
}

interface Source {
  name: string;
  load: () => Promise<ArrayBuffer>;
}

interface Failure {
  name: string;
  reason: 'failed' | 'empty';
}

const scopeFor = (cat: string): Scope => (cat === 'exam' ? 'exam' : cat === 'colloquium' ? 'colloquium' : 'all');

/** Prefers text-based formats; scans are only chosen when there is nothing better. */
function autoSelect(paths: string[]): string[] {
  const text = paths.filter((p) => !isImage(p)).sort((a, b) => formatRank(a) - formatRank(b));
  return text.length ? text.slice(0, AUTO_FILES) : paths.slice(0, AUTO_OCR);
}

const toRows = (drafts: Draft[]): Row[] => drafts.map((d) => ({ ...d, key: uid(), on: true }));

export function GeneratePage() {
  const { courseId } = useParams();
  const [params] = useSearchParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { course, loading, error } = useCourse(courseId);
  const { data: materials, error: materialsError } = useMaterials(course);
  const initialCat = (CATS.find((c) => c === params.get('cat')) ?? 'all') as MaterialCat | 'all';

  const [cat, setCat] = useState<MaterialCat | 'all'>(initialCat);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploads, setUploads] = useState<File[]>([]);
  const [pasted, setPasted] = useState('');
  const [cloze, setCloze] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; name: string; fraction: number } | null>(null);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [sourceText, setSourceText] = useState('');
  const [deckName, setDeckName] = useState('');
  const [deckScope, setDeckScope] = useState<Scope>(scopeFor(initialCat));
  const [aiReply, setAiReply] = useState('');
  const [aiProblem, setAiProblem] = useState(false);
  const [copied, setCopied] = useState(false);
  const cancelled = useRef(false);
  useTitle(course ? `${t('gen.title')} · ${course.code}` : t('gen.title'));

  const usable = useMemo(() => (materials ?? []).filter(([p]) => isExtractable(p)), [materials]);
  const visible = useMemo(() => usable.filter(([, c]) => cat === 'all' || c === cat), [usable, cat]);

  useEffect(() => {
    if (materials) setSelected(new Set(autoSelect(materials.filter(([p, c]) => isExtractable(p) && (initialCat === 'all' || c === initialCat)).map(([p]) => p))));
  }, [materials, initialCat]);

  if (error || materialsError) return <LoadError />;
  if (loading) return <Loading />;
  if (!course) return <Message title={t('notfound')} />;
  if (course.files && !materials) return <Loading />;

  const backLink = `/c/${encodeURIComponent(course.id)}`;
  const picks = [...selected];
  const hasScans = picks.some(isImage) || uploads.some((f) => isImage(f.name));
  const canRun = picks.length + uploads.length > 0 || pasted.trim().length > 0;

  const toggle = (path: string) => {
    const next = new Set(selected);
    if (next.has(path)) next.delete(path);
    else if (next.size < MAX_FILES) next.add(path);
    setSelected(next);
  };

  const run = async () => {
    cancelled.current = false;
    const sources: Source[] = [
      ...picks.map((path) => ({
        name: path,
        load: async () => {
          const response = await fetch(rawUrl(course, path));
          if (!response.ok) throw new Error(String(response.status));
          return response.arrayBuffer();
        },
      })),
      ...uploads.map((file) => ({ name: file.name, load: () => file.arrayBuffer() })),
    ];
    const drafts: Draft[] = [];
    const problems: Failure[] = [];
    const texts: string[] = [];

    if (pasted.trim()) {
      texts.push(pasted);
      drafts.push(...generateCards(pasted, { cloze }));
    }
    for (let i = 0; i < sources.length && !cancelled.current; i++) {
      const source = sources[i];
      const name = source.name.split('/').pop()!;
      setProgress({ done: i, total: sources.length, name, fraction: 0 });
      try {
        const buffer = await source.load();
        if (buffer.byteLength > MAX_FILE_BYTES) throw new Error('too large');
        const text = cleanText(await extractText(source.name, buffer, (fraction) => setProgress({ done: i, total: sources.length, name, fraction })));
        if (text.length < 20) {
          problems.push({ name, reason: 'empty' });
          continue;
        }
        texts.push(`--- ${name} ---\n${text}`);
        drafts.push(...generateCards(text, { cloze, file: name }));
      } catch {
        problems.push({ name, reason: 'failed' });
      }
    }

    setProgress(null);
    setFailures(problems);
    setSourceText(texts.join('\n\n'));
    setRows(toRows(drafts));
    setDeckName((name) => name || `${course.code} · ${t(`scope.${deckScope}`)}`);
    window.scrollTo(0, 0);
  };

  const patchRow = (key: string, patch: Partial<Row>) => setRows((list) => list!.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const toggleAnswer = (row: Row, index: number) => {
    const answers = row.answers!.map((a, i) => (i === index ? { ...a, c: !a.c } : a));
    patchRow(row.key, { answers, back: answers.filter((a) => a.c).map((a) => a.t).join('\n') });
  };

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(AI_PROMPT + sourceText.slice(0, MAX_PROMPT_CHARS));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addAi = () => {
    const drafts = parseImport(aiReply);
    setAiProblem(drafts.length === 0);
    if (drafts.length) {
      setRows((list) => [...toRows(drafts), ...(list ?? [])]);
      setAiReply('');
    }
  };

  const save = () => {
    const cards = rows!.filter((r) => r.on && r.front.trim()).map(({ key, on: _on, ...draft }) => ({ ...draft, id: key }));
    addDeck({ id: uid(), courseId: course.id, name: deckName.trim() || course.code, scope: deckScope, createdAt: Date.now(), cards });
    navigate(`${backLink}?scope=${deckScope}`);
  };

  if (progress) {
    return (
      <div className="narrow">
        <Message title={t('gen.running', { a: progress.done + 1, b: progress.total })}>
          <p className="muted ellipsis">{progress.name}</p>
          <ProgressBar value={progress.done + progress.fraction} max={progress.total} />
          <button type="button" className="btn" onClick={() => { cancelled.current = true; }}>{t('gen.stop')}</button>
        </Message>
      </div>
    );
  }

  if (rows) {
    const chosen = rows.filter((r) => r.on).length;
    return (
      <div className="narrow stack">
        <button type="button" className="back-link" onClick={() => setRows(null)}><ArrowLeft size={16} aria-hidden /> {t('gen.back')}</button>
        <h1>{t('gen.result')}</h1>
        {failures.length > 0 && (
          <ul className="failures">
            {failures.map((f) => <li key={f.name}>{t(f.reason === 'failed' ? 'gen.fileFailed' : 'gen.fileEmpty')}: {f.name}</li>)}
          </ul>
        )}
        {rows.length === 0 && <p className="notice">{t('gen.nothing')}</p>}

        {rows.length > 0 && (
          <>
            <div className="panel save-panel">
              <label className="field grow">
                <span className="label">{t('gen.deckName')}</span>
                <input className="input" value={deckName} onChange={(e) => setDeckName(e.target.value)} />
              </label>
              <label className="field">
                <span className="label">{t('gen.deckScope')}</span>
                <select className="input" value={deckScope} onChange={(e) => setDeckScope(e.target.value as Scope)}>
                  {(['all', 'colloquium', 'exam'] as Scope[]).map((s) => <option key={s} value={s}>{t(`scope.${s}`)}</option>)}
                </select>
              </label>
              <button type="button" className="btn primary" disabled={!chosen} onClick={save}>{t('gen.saveDeck')} <small>{chosen}</small></button>
            </div>
            <div className="row between">
              <span className="muted">{t('gen.found', { n: rows.length, m: chosen })}</span>
              <div className="row">
                <button type="button" className="text-btn" onClick={() => setRows(rows.map((r) => ({ ...r, on: true })))}>{t('gen.selectAll')}</button>
                <button type="button" className="text-btn" onClick={() => setRows(rows.map((r) => ({ ...r, on: false })))}>{t('gen.selectNone')}</button>
              </div>
            </div>
            <ul className="draft-list">
              {rows.slice(0, 300).map((r) => (
                <li key={r.key} className={r.on ? '' : 'off'}>
                  <input type="checkbox" checked={r.on} onChange={(e) => patchRow(r.key, { on: e.target.checked })} aria-label={r.front.slice(0, 60)} />
                  <div className="draft-fields">
                    <div className="question-meta">
                      <span className="tag">{t(`gen.type.${r.type}` as Key)}</span>
                      {!r.back.trim() && <span className="tag warn">{t('gen.noAnswer')}</span>}
                      {r.file && <span className="muted ellipsis">{r.file}</span>}
                    </div>
                    <textarea className="input" rows={2} value={r.front} onChange={(e) => patchRow(r.key, { front: e.target.value })} aria-label={t('add.front')} />
                    {r.answers?.length ? (
                      <ul className="answer-list">
                        {r.answers.map((a, i) => (
                          <li key={i} className={a.c ? 'yes' : ''}>
                            <label className="check">
                              <input type="checkbox" checked={a.c} onChange={() => toggleAnswer(r, i)} />
                              <span>{a.t}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <textarea className="input" rows={2} value={r.back} placeholder={t('gen.backPh')} onChange={(e) => patchRow(r.key, { back: e.target.value })} aria-label={t('add.back')} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        <section className="panel stack">
          <h2>{t('gen.ai')}</h2>
          <p className="muted">{t('gen.ai.body')}</p>
          <div><button type="button" className="btn" disabled={!sourceText} onClick={() => void copyPrompt()}>{t(copied ? 'gen.ai.copied' : 'gen.ai.copy')}</button></div>
          <textarea className="input mono" rows={5} value={aiReply} onChange={(e) => setAiReply(e.target.value)} placeholder={t('gen.ai.ph')} aria-label={t('gen.ai.ph')} />
          {aiProblem && <p className="alert" role="alert">{t('gen.ai.bad')}</p>}
          <div><button type="button" className="btn primary" disabled={!aiReply.trim()} onClick={addAi}>{t('gen.ai.add')}</button></div>
        </section>
      </div>
    );
  }

  const cats = CATS.filter((c) => c === 'all' || usable.some(([, x]) => x === c));

  return (
    <div className="narrow stack">
      <Link className="back-link" to={backLink}><ArrowLeft size={16} aria-hidden /> {course.code}</Link>
      <h1>{t('gen.title')}</h1>

      {course.files && (
        <section className="panel stack">
          <div className="row between">
            <h2>{t('gen.pick')}</h2>
            <span className="muted">{t('gen.selected', { n: selected.size })}</span>
          </div>
          <div className="chips">
            {cats.map((c) => <button key={c} type="button" className={`chip ${cat === c ? 'on' : ''}`} aria-pressed={cat === c} onClick={() => setCat(c)}>{t(`cat.${c}`)}</button>)}
          </div>
          {visible.length === 0 && <p className="muted">{t('gen.none')}</p>}
          <ul className="pick-list">
            {visible.slice(0, 400).map(([path]) => (
              <li key={path}>
                <label className="check">
                  <input type="checkbox" checked={selected.has(path)} onChange={() => toggle(path)} />
                  <span className="pick-name">{isOwnMaterial(path) && <span className="tag">{t('materials.own')}</span>}{' '}<span className="file-dir">{materialDir(path)}</span>{path.slice(path.lastIndexOf('/') + 1)}</span>
                </label>
              </li>
            ))}
          </ul>
          {selected.size >= MAX_FILES && <p className="hint left">{t('gen.limit', { n: MAX_FILES })}</p>}
        </section>
      )}

      <section className="panel stack">
        <label className="btn upload">
          <Upload size={16} aria-hidden /> {t('gen.upload')}
          <input type="file" multiple hidden accept=".txt,.md,.pdf,.docx,.pptx,.odt,.html,.htm,.rtf,.doc,.ppt,.jpg,.jpeg,.png,.bmp" onChange={(e) => { setUploads([...uploads, ...Array.from(e.target.files ?? [])]); e.target.value = ''; }} />
        </label>
        {uploads.length > 0 && <ul className="failures neutral">{uploads.map((f, i) => <li key={i}>{f.name}</li>)}</ul>}
        <label className="field">
          <span className="label">{t('gen.paste')}</span>
          <textarea className="input" rows={4} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={t('gen.pastePh')} />
        </label>
        <label className="check"><input type="checkbox" checked={cloze} onChange={(e) => setCloze(e.target.checked)} /> {t('gen.cloze')}</label>
      </section>

      {hasScans && <p className="notice">{t('gen.ocrNote')}</p>}
      <button type="button" className="btn primary wide" disabled={!canRun} onClick={() => void run()}>{t('gen.run')}</button>
    </div>
  );
}
