import { Plus, Send, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LoadError, Loading, Rich, useTitle } from '../components/Common';
import { useCatalog } from '../data';
import { useI18n, type Key } from '../i18n';
import { publishLink } from '../lib/github';
import { parseImport } from '../lib/importText';
import { lastSaveFailed, saveLocalQuestions, uid, useStore } from '../store';
import type { Answer, Draft, RawQuestion, Scope } from '../types';

const SCOPES: Scope[] = ['all', 'colloquium', 'exam'];
const emptyAnswers = () => [{ t: '', c: false }, { t: '', c: false }, { t: '', c: false }, { t: '', c: false }];

const toAnswers = (list: { t: string; c: boolean }[]): Answer[] => list.map((a) => ({ t: a.t, c: a.c, f: 'md' }));

function draftToQuestion(draft: Draft, scope: Scope): RawQuestion {
  return { id: uid(), q: draft.front, f: 'md', a: toAnswers(draft.answers ?? []), back: draft.answers?.length ? undefined : draft.back, scope };
}

export function AddPage() {
  const { t } = useI18n();
  const { data, error } = useCatalog();
  const [params, setParams] = useSearchParams();
  const local = useStore((s) => s.local);
  const courseId = params.get('course') ?? '';
  const [tab, setTab] = useState<'single' | 'bulk'>('single');
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);
  const [publishNote, setPublishNote] = useState('');
  useTitle(t('add.title'));

  const courses = useMemo(() => data?.courses ?? [], [data]);
  const course = courses.find((c) => c.id === courseId);
  const mine = useMemo(() => local[courseId] ?? [], [local, courseId]);
  const [editing, setEditing] = useState<RawQuestion | null>(null);

  useEffect(() => setEditing(null), [courseId]);

  if (error) return <LoadError />;
  if (!data) return <Loading />;

  const report = (text: Key) => {
    setNotice(lastSaveFailed() ? { text: t('add.saveFailed'), bad: true } : { text: t(text) });
  };

  const store = (questions: RawQuestion[]) => {
    saveLocalQuestions(courseId, questions);
  };

  const remove = (id: string) => {
    if (confirm(t('add.deleteConfirm'))) store(mine.filter((q) => q.id !== id));
  };

  const publish = () => {
    const link = publishLink(courseId, course?.name || course?.code || courseId, mine, t('add.issueAttach'));
    if (link.file) {
      const url = URL.createObjectURL(new Blob([link.file.content], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = link.file.name;
      a.click();
      URL.revokeObjectURL(url);
      setPublishNote(t('add.publishFile', { file: link.file.name }));
    }
    window.open(link.url, '_blank', 'noopener');
  };

  return (
    <div className="narrow stack">
      <header>
        <h1>{t('add.title')}</h1>
        <p className="lead">{t('add.lead')}</p>
      </header>

      <div className="panel stack">
        <label className="field">
          <span className="label">{t('add.course')}</span>
          <select className="input" value={courseId} onChange={(e) => setParams(e.target.value ? { course: e.target.value } : {}, { replace: true })}>
            <option value="">{t('add.pick')}</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.code}{c.name ? ` – ${c.name}` : ''}</option>)}
          </select>
        </label>

        {course && (
          <>
            <div className="segmented" role="group">
              <button type="button" className={tab === 'single' ? 'on' : ''} aria-pressed={tab === 'single'} onClick={() => setTab('single')}>{t('add.single')}</button>
              <button type="button" className={tab === 'bulk' ? 'on' : ''} aria-pressed={tab === 'bulk'} onClick={() => setTab('bulk')}>{t('add.bulk')}</button>
            </div>
            {tab === 'single' ? (
              <SingleForm
                key={editing?.id ?? 'new'}
                initial={editing}
                onCancel={() => setEditing(null)}
                onSave={(q) => {
                  store(editing ? mine.map((x) => (x.id === editing.id ? q : x)) : [q, ...mine]);
                  setEditing(null);
                  report('add.added');
                }}
              />
            ) : (
              <BulkForm onSave={(list) => { store([...list, ...mine]); report('add.added'); }} />
            )}
          </>
        )}
        {notice && <p className={notice.bad ? 'alert' : 'notice'} role="status">{notice.text}</p>}
      </div>

      {course && mine.length > 0 && (
        <section className="stack">
          <div className="row between">
            <h2 className="section-title">{t('add.mine', { n: mine.length })}</h2>
            <button type="button" className="btn primary" onClick={publish}><Send size={15} aria-hidden /> {t('add.publish')}</button>
          </div>
          <p className="hint left">{t('add.publishHint')}</p>
          {publishNote && <p className="notice" role="status">{publishNote}</p>}
          <ul className="mine-list">
            {mine.map((q) => (
              <li key={q.id}>
                <div className="grow"><Rich text={q.q} format={q.f} /></div>
                <button type="button" className="btn small" onClick={() => { setTab('single'); setEditing(q); window.scrollTo(0, 0); }}>{t('common.edit')}</button>
                <button type="button" className="icon-btn danger" aria-label={t('common.delete')} onClick={() => remove(q.id)}><Trash2 size={16} aria-hidden /></button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SingleForm({ initial, onSave, onCancel }: { initial: RawQuestion | null; onSave: (q: RawQuestion) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [kind, setKind] = useState<'test' | 'card'>(initial?.back ? 'card' : 'test');
  const [question, setQuestion] = useState(initial?.q ?? '');
  const [code, setCode] = useState(initial?.code ?? '');
  const [answers, setAnswers] = useState<{ t: string; c: boolean }[]>(initial?.a.length ? initial.a.map(({ t: text, c }) => ({ t: text, c })) : emptyAnswers());
  const [back, setBack] = useState(initial?.back ?? '');
  const [why, setWhy] = useState(initial?.why ?? '');
  const [scope, setScope] = useState<Scope>(initial?.scope ?? 'all');
  const [problem, setProblem] = useState('');
  const questionRef = useRef<HTMLTextAreaElement>(null);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const filled = answers.filter((a) => a.t.trim());
    if (!question.trim()) return setProblem(t('add.needText'));
    if (kind === 'test' && (filled.length < 2 || !filled.some((a) => a.c))) return setProblem(t('add.needAnswers'));
    if (kind === 'card' && !back.trim()) return setProblem(t('add.needBack'));
    onSave({
      id: initial?.id ?? uid(),
      q: question.trim(),
      f: 'md',
      a: kind === 'test' ? toAnswers(filled) : [],
      code: code.trim() || undefined,
      why: why.trim() || undefined,
      back: kind === 'card' ? back.trim() : undefined,
      scope,
    });
    setProblem('');
    setQuestion('');
    setCode('');
    setBack('');
    setWhy('');
    setAnswers(emptyAnswers());
    questionRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit();
  };

  const patch = (index: number, value: Partial<{ t: string; c: boolean }>) =>
    setAnswers(answers.map((a, i) => (i === index ? { ...a, ...value } : a)));

  return (
    <form className="stack" onSubmit={submit} onKeyDown={onKeyDown}>
      <div className="segmented" role="group">
        <button type="button" className={kind === 'test' ? 'on' : ''} aria-pressed={kind === 'test'} onClick={() => setKind('test')}>{t('add.kind.test')}</button>
        <button type="button" className={kind === 'card' ? 'on' : ''} aria-pressed={kind === 'card'} onClick={() => setKind('card')}>{t('add.kind.card')}</button>
      </div>
      <label className="field">
        <span className="label">{t(kind === 'test' ? 'add.question' : 'add.front')}</span>
        <textarea ref={questionRef} className="input" rows={3} autoFocus value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t('add.questionPh')} />
      </label>
      {question.trim() && <div className="preview"><span className="label">{t('add.preview')}</span><Rich text={question} format="md" /></div>}
      {kind === 'test' ? (
        <>
          <label className="field">
            <span className="label">{t('add.code')}</span>
            <textarea className="input mono" rows={2} value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} />
          </label>
          <fieldset className="answers">
            <legend className="label">{t('add.answers')} <small>{t('add.answersHint')}</small></legend>
            {answers.map((a, i) => (
              <div key={i} className="answer-row">
                <input type="checkbox" checked={a.c} onChange={(e) => patch(i, { c: e.target.checked })} aria-label={t('add.answersHint')} />
                <input className="input" value={a.t} onChange={(e) => patch(i, { t: e.target.value })} placeholder={t('add.answerPh', { n: i + 1 })} />
                <button type="button" className="icon-btn" disabled={answers.length <= 2} onClick={() => setAnswers(answers.filter((_, x) => x !== i))} aria-label={t('common.delete')}><X size={15} aria-hidden /></button>
              </div>
            ))}
            {answers.length < 12 && <button type="button" className="text-btn" onClick={() => setAnswers([...answers, { t: '', c: false }])}><Plus size={14} aria-hidden /> {t('add.addAnswer')}</button>}
          </fieldset>
        </>
      ) : (
        <label className="field">
          <span className="label">{t('add.back')}</span>
          <textarea className="input" rows={3} value={back} onChange={(e) => setBack(e.target.value)} />
        </label>
      )}
      <label className="field">
        <span className="label">{t('add.why')}</span>
        <input className="input" value={why} onChange={(e) => setWhy(e.target.value)} />
      </label>
      <div className="field">
        <span className="label">{t('add.scope')}</span>
        <div className="segmented" role="group">
          {SCOPES.map((s) => <button key={s} type="button" className={scope === s ? 'on' : ''} aria-pressed={scope === s} onClick={() => setScope(s)}>{t(`scope.${s}`)}</button>)}
        </div>
      </div>
      {problem && <p className="alert" role="alert">{problem}</p>}
      <div className="row">
        <button className="btn primary">{t(initial ? 'add.update' : 'add.submit')} <small>{t('add.shortcut')}</small></button>
        {initial && <button type="button" className="btn" onClick={onCancel}>{t('common.cancel')}</button>}
      </div>
    </form>
  );
}

function BulkForm({ onSave }: { onSave: (questions: RawQuestion[]) => void }) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const drafts = useMemo(() => parseImport(text).filter((d) => d.front && (d.back || d.answers?.some((a) => a.c))), [text]);

  return (
    <div className="stack">
      <p className="hint left">{t('add.bulkHelp')}</p>
      <textarea className="input mono" rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('add.bulkExample')} aria-label={t('add.bulk')} spellCheck={false} />
      <div className="segmented" role="group">
        {SCOPES.map((s) => <button key={s} type="button" className={scope === s ? 'on' : ''} aria-pressed={scope === s} onClick={() => setScope(s)}>{t(`scope.${s}`)}</button>)}
      </div>
      <div className="row between">
        <span className="muted">{t('add.bulkFound', { n: drafts.length })}</span>
        <button type="button" className="btn primary" disabled={!drafts.length} onClick={() => { onSave(drafts.map((d) => draftToQuestion(d, scope))); setText(''); }}>{t('add.bulkAdd', { n: drafts.length })}</button>
      </div>
    </div>
  );
}
