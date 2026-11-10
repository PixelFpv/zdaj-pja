import { BookOpenCheck, ClipboardCheck, ExternalLink, Layers, Link2, Pencil, Plus, Repeat2, Scale, Sparkles, Trash2, type LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { LoadError, Loading, Message, Rich, useTitle } from '../components/Common';
import { useCourse, useCourseCards, useMaterials } from '../data';
import { useI18n, type Key } from '../i18n';
import { buildOptions, correctAnswers, filterScope, hasKey, typedAnswer } from '../lib/cards';
import { viewUrl } from '../lib/github';
import { toPlain } from '../lib/rich';
import { normalizeAnswer } from '../lib/text';
import { removeDeck, setScope, useStore } from '../store';
import type { Card, Course, MaterialCat, Scope, StudyMode } from '../types';

const SCOPES: Scope[] = ['all', 'colloquium', 'exam'];
const PAGE = 40;

export function CoursePage() {
  const { courseId } = useParams();
  const { t } = useI18n();
  const { course, loading, error } = useCourse(courseId);
  const [params, setParams] = useSearchParams();
  const { cards, loading: cardsLoading, error: cardsError } = useCourseCards(course);
  useTitle(course?.code);

  if (error || cardsError) return <LoadError />;
  if (loading) return <Loading />;
  if (!course) return <Message title={t('notfound')}><Link className="btn primary" to="/">{t('notfound.home')}</Link></Message>;

  const tab = params.get('tab') ?? 'learn';
  const setTab = (next: string) => setParams((p) => { p.set('tab', next); return p; }, { replace: true });
  const ppj = course.banks.find((b) => b.source === 'ppj');

  return (
    <>
      <header className="course-head">
        <div>
          <span className="course-code big">{course.code}</span>
          {course.name && <h1>{course.name}</h1>}
        </div>
        <div className="course-head-actions">
          {ppj?.url && <a className="btn" href={ppj.url} target="_blank" rel="noreferrer">{t('course.openPpj')} <ExternalLink size={15} aria-hidden /></a>}
          <Link className="btn" to={`/add?course=${encodeURIComponent(course.id)}`}><Plus size={16} aria-hidden /> {t('course.addOwn')}</Link>
        </div>
      </header>

      <div className="tabs" role="tablist">
        {(['learn', 'questions', 'materials'] as const).filter((x) => x !== 'materials' || course.files).map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x} className={tab === x ? 'on' : ''} onClick={() => setTab(x)}>{t(`course.tab.${x}`)}</button>
        ))}
      </div>

      {cardsLoading ? <Loading /> : tab === 'questions' ? (
        <QuestionsTab cards={cards} />
      ) : tab === 'materials' && course.files ? (
        <MaterialsTab course={course} />
      ) : (
        <LearnTab course={course} cards={cards} />
      )}
    </>
  );
}

const MODES: { mode: StudyMode; icon: LucideIcon; usable: (pool: Card[]) => boolean }[] = [
  { mode: 'review', icon: Repeat2, usable: (p) => p.length > 0 },
  { mode: 'flashcards', icon: Layers, usable: (p) => p.length > 0 },
  { mode: 'learn', icon: BookOpenCheck, usable: (p) => p.some((c) => hasKey(c) && buildOptions(c, p).length >= 2) },
  { mode: 'test', icon: ClipboardCheck, usable: (p) => p.some((c) => hasKey(c) && buildOptions(c, p).length >= 2) },
  { mode: 'write', icon: Pencil, usable: (p) => p.some((c) => typedAnswer(c)) },
  { mode: 'match', icon: Link2, usable: (p) => p.filter((c) => typedAnswer(c)).length >= 4 },
  { mode: 'truefalse', icon: Scale, usable: (p) => p.some((c) => (c.answers.length >= 2 && correctAnswers(c).length > 0) || !!c.back?.trim()) },
];

function LearnTab({ course, cards }: { course: Course; cards: Card[] }) {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const scope = (SCOPES.find((s) => s === params.get('scope')) ?? 'all') as Scope;
  const off = useMemo(() => new Set((params.get('off') ?? '').split(',').filter(Boolean)), [params]);
  const decks = useStore((s) => s.decks);
  const courseDecks = decks.filter((d) => d.courseId === course.id);

  const sources = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    for (const c of cards) {
      const entry = map.get(c.sourceId) ?? { label: c.sourceId.startsWith('local-') ? t('course.local') : c.sourceLabel, count: 0 };
      entry.count += 1;
      map.set(c.sourceId, entry);
    }
    return [...map.entries()];
  }, [cards, t]);

  const enabled = useMemo(() => cards.filter((c) => !off.has(c.sourceId)), [cards, off]);
  const pool = useMemo(() => filterScope(enabled, scope), [enabled, scope]);
  const query = new URLSearchParams();
  query.set('scope', scope);
  if (off.size) query.set('off', [...off].join(','));

  const update = (fn: (p: URLSearchParams) => void) => setParams((p) => { fn(p); return p; }, { replace: true });
  const toggleSource = (id: string) => update((p) => {
    const next = new Set(off);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (next.size) p.set('off', [...next].join(','));
    else p.delete('off');
  });

  const generateLink = (cat: string) => `/c/${encodeURIComponent(course.id)}/generate?cat=${cat}`;
  const files = course.files;

  return (
    <div className="stack">
      {cards.length > 0 && (
        <div className="panel controls">
          <div>
            <span className="label">{t('course.scope')}</span>
            <div className="segmented" role="group">
              {SCOPES.map((s) => {
                const count = filterScope(enabled, s).length;
                return (
                  <button key={s} type="button" className={scope === s ? 'on' : ''} aria-pressed={scope === s} onClick={() => update((p) => p.set('scope', s))}>
                    {t(`scope.${s}`)} <small>{count}</small>
                  </button>
                );
              })}
            </div>
          </div>
          {sources.length > 1 && (
            <div>
              <span className="label">{t('course.sources')}</span>
              <div className="chips">
                {sources.map(([id, { label, count }]) => (
                  <button key={id} type="button" className={`chip ${off.has(id) ? '' : 'on'}`} aria-pressed={!off.has(id)} onClick={() => toggleSource(id)}>{label} <small>{count}</small></button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {cards.length === 0 && files && files.usable > 0 && (
        <Message title={t('course.noBank.title')}><p>{t('course.noBank.body')}</p></Message>
      )}
      {cards.length === 0 && !files && <Message><p>{t('course.noMaterials')}</p></Message>}
      {cards.length > 0 && pool.length === 0 && (
        <Message title={t('course.noScope.title')}><p>{t('course.noScope.body')}</p></Message>
      )}

      {pool.length > 0 && (
        <section>
          <h2 className="section-title">{t('course.modes')}</h2>
          <div className="mode-grid">
            {MODES.map(({ mode, icon: Icon, usable }) => {
              const can = usable(pool);
              const body = (
                <>
                  <span className="mode-icon"><Icon size={20} /></span>
                  <span className="mode-name">{t(`mode.${mode}` as Key)}</span>
                  <span className="mode-desc">{can ? t(`mode.${mode}.d` as Key) : t('course.needs')}</span>
                </>
              );
              return can ? (
                <Link key={mode} className="mode-card" to={`/c/${encodeURIComponent(course.id)}/study/${mode}?${query}`}>{body}</Link>
              ) : (
                <div key={mode} className="mode-card disabled" aria-disabled="true">{body}</div>
              );
            })}
          </div>
        </section>
      )}

      {files && files.usable > 0 && (
        <section className="panel generate-panel">
          <div>
            <h2><Sparkles size={18} aria-hidden /> {t('course.generate')}</h2>
            <p className="muted">{t('course.generate.body')}</p>
          </div>
          <div className="row">
            {files.exam > 0 && <Link className="btn primary" to={generateLink('exam')}>{t('course.gen.exam')} <small>{files.exam}</small></Link>}
            {files.colloquium > 0 && <Link className="btn primary" to={generateLink('colloquium')}>{t('course.gen.colloquium')} <small>{files.colloquium}</small></Link>}
            <Link className="btn" to={generateLink('all')}>{t('course.gen.all')} <small>{files.usable}</small></Link>
          </div>
        </section>
      )}

      {courseDecks.length > 0 && (
        <section>
          <h2 className="section-title">{t('course.decks')}</h2>
          <ul className="deck-list">
            {courseDecks.map((d) => (
              <li key={d.id}>
                <div><b>{d.name}</b><span className="muted"> · {d.cards.length} · {t(`scope.${d.scope}`)}</span></div>
                <button type="button" className="icon-btn danger" aria-label={t('common.delete')} title={t('common.delete')} onClick={() => { if (confirm(t('course.deleteDeck', { name: d.name }))) removeDeck(d.id); }}><Trash2 size={16} aria-hidden /></button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function QuestionsTab({ cards }: { cards: Card[] }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const results = useMemo(() => {
    const needle = normalizeAnswer(query);
    if (!needle) return cards;
    return cards.filter((c) => normalizeAnswer(`${toPlain(c.front, c.format)} ${c.answers.map((a) => toPlain(a.t, a.f)).join(' ')} ${c.back ?? ''}`).includes(needle));
  }, [cards, query]);

  return (
    <div className="stack">
      <div className="filters">
        <input className="input" type="search" value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} placeholder={t('questions.search')} aria-label={t('questions.search')} />
        <span className="muted">{t('questions.count', { n: results.length })}</span>
      </div>
      <div className="question-list">
        {results.slice(0, limit).map((card) => <QuestionRow key={card.id} card={card} />)}
      </div>
      {limit < results.length && <button type="button" className="btn wide" onClick={() => setLimit(limit + PAGE)}>{t('common.showMore')}</button>}
    </div>
  );
}

function QuestionRow({ card }: { card: Card }) {
  const { t } = useI18n();
  return (
    <article className="question-row">
      <div className="question-meta">
        <span className="tag">{card.sourceId.startsWith('local-') ? t('course.local') : card.sourceLabel}</span>
        {card.tags.map((tag) => <span key={tag} className="tag soft">{tag}</span>)}
        {!hasKey(card) && <span className="tag warn">{t('questions.noKey')}</span>}
        <select className="mini-select" value={card.scope} aria-label={t('questions.setScope')} onChange={(e) => setScope(card.id, e.target.value as Scope)}>
          {SCOPES.map((s) => <option key={s} value={s}>{t(`scope.${s}`)}</option>)}
        </select>
      </div>
      <Rich text={card.front} format={card.format} />
      {card.code && <pre className="code">{card.code}</pre>}
      {card.answers.length > 0 && (
        <ul className="answer-list">
          {card.answers.map((a, i) => <li key={i} className={a.c ? 'yes' : ''}><span aria-hidden>{a.c ? '✓' : '·'}</span><Rich text={a.t} format={a.f} inline /></li>)}
        </ul>
      )}
      {card.back && !card.answers.length && <div className="plain-back"><Rich text={card.back} format={card.format === 'md' ? 'md' : 'text'} /></div>}
      {card.why && <p className="why">{card.why}</p>}
      {card.comments.length > 0 && (
        <details className="comments">
          <summary>{t('questions.comments', { n: card.comments.length })}</summary>
          {card.comments.map((c, i) => (
            <div key={i} className="comment">
              <small>{c.by}{c.at ? ` · ${String(c.at).slice(0, 10)}` : ''}</small>
              <Rich text={c.t} format="html" />
            </div>
          ))}
        </details>
      )}
    </article>
  );
}

const CATS: (MaterialCat | 'all')[] = ['all', 'exam', 'colloquium', 'lecture', 'lab', 'other'];
const USABLE = /\.(txt|md|pdf|docx|pptx|odt|sxw|html?|rtf|doc|ppt|pps|mht|jpe?g|png|bmp)$/i;

function MaterialsTab({ course }: { course: Course }) {
  const { t } = useI18n();
  const { data, error } = useMaterials(course);
  const [cat, setCat] = useState<MaterialCat | 'all'>('all');
  const [docsOnly, setDocsOnly] = useState(true);
  const [limit, setLimit] = useState(100);

  if (error) return <LoadError />;
  if (!data) return <Loading />;

  const visible = data.filter(([path, c]) => (cat === 'all' || c === cat) && (!docsOnly || USABLE.test(path)));
  const cats = CATS.filter((c) => c === 'all' || (course.files?.[c] ?? 0) > 0);

  return (
    <div className="stack">
      <div className="filters">
        <div className="chips">
          {cats.map((c) => <button key={c} type="button" className={`chip ${cat === c ? 'on' : ''}`} aria-pressed={cat === c} onClick={() => { setCat(c); setLimit(100); }}>{t(`cat.${c}`)}</button>)}
        </div>
        <label className="check"><input type="checkbox" checked={docsOnly} onChange={(e) => setDocsOnly(e.target.checked)} /> {t('materials.docsOnly')}</label>
      </div>
      <div className="row between">
        <span className="muted">{t('materials.count', { n: visible.length })}</span>
        <Link className="btn primary" to={`/c/${encodeURIComponent(course.id)}/generate?cat=${cat}`}><Sparkles size={16} aria-hidden /> {t('course.generate')}</Link>
      </div>
      <ul className="file-list">
        {visible.slice(0, limit).map(([path]) => (
          <li key={path}>
            <a href={viewUrl(course.root!, path)} target="_blank" rel="noreferrer" title={t('materials.open')}>
              <span className="file-dir">{path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : ''}</span>
              {path.slice(path.lastIndexOf('/') + 1)}
            </a>
          </li>
        ))}
      </ul>
      {limit < visible.length && <button type="button" className="btn wide" onClick={() => setLimit(limit + 100)}>{t('common.showMore')}</button>}
    </div>
  );
}
