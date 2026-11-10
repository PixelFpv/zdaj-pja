import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BASED_ON_LINKS, Linked, LoadError, Loading, useTitle } from '../components/Common';
import { useCatalog } from '../data';
import { useI18n, type Key, type Translate } from '../i18n';
import { normalizeAnswer } from '../lib/text';
import { streak, useStore } from '../store';
import type { Course } from '../types';

type Filter = 'all' | 'questions' | 'materials';

const questionCount = (c: Course) => c.banks.reduce((sum, b) => sum + b.count, 0);

function groupKey(c: Course): string {
  if (c.level === 'mgr') return c.sem === 'blokowe' ? 'z-blocks' : `m-${c.sem}`;
  return c.sem ? `a-${c.sem}` : 'zz-other';
}

function groupLabel(key: string, t: Translate): string {
  const [kind, n] = key.split('-');
  if (kind === 'a') return t('home.sem', { n });
  if (kind === 'm') return t('home.mgr', { n });
  return kind === 'z' ? t('home.blocks') : t('home.other');
}

export function HomePage() {
  const { t, lang } = useI18n();
  const { data, error } = useCatalog();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const srs = useStore((s) => s.srs);
  const decks = useStore((s) => s.decks);
  const days = useStore((s) => s.days);
  useTitle(undefined);

  const groups = useMemo(() => {
    if (!data) return [];
    const needle = normalizeAnswer(query);
    const matches = data.courses.filter((c) => {
      if (filter === 'questions' && !c.banks.length) return false;
      if (filter === 'materials' && c.banks.length) return false;
      return !needle || normalizeAnswer(`${c.code} ${c.name} ${c.banks.map((b) => b.title).join(' ')}`).includes(needle);
    });
    const map = new Map<string, Course[]>();
    for (const c of matches) map.set(groupKey(c), [...(map.get(groupKey(c)) ?? []), c]);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data, query, filter]);

  const due = useMemo(() => {
    if (!data) return [];
    const owner = new Map<string, Course>();
    for (const c of data.courses) {
      owner.set(`local-${c.id}`, c);
      for (const b of c.banks) owner.set(b.id, c);
    }
    for (const d of decks) {
      const c = data.courses.find((x) => x.id === d.courseId);
      if (c) owner.set(`deck-${d.id}`, c);
    }
    const now = Date.now();
    const counts = new Map<Course, number>();
    for (const [id, state] of Object.entries(srs)) {
      const course = owner.get(id.slice(0, id.indexOf(':')));
      if (course && state.due <= now) counts.set(course, (counts.get(course) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [data, srs, decks]);

  if (error) return <LoadError />;
  if (!data) return <Loading />;

  const number = new Intl.NumberFormat(lang === 'pl' ? 'pl-PL' : 'en-GB');
  const plural = new Intl.PluralRules(lang === 'pl' ? 'pl-PL' : 'en-GB');
  const totalQuestions = data.courses.reduce((sum, c) => sum + questionCount(c), 0);
  const totalFiles = data.courses.reduce((sum, c) => sum + (c.files?.total ?? 0), 0);
  const studiedToday = days[new Date().toLocaleDateString('sv')] ?? 0;
  const currentStreak = streak(days);
  const showToday = due.length > 0 || studiedToday > 0;

  return (
    <>
      <section className="hero">
        <h1>{t('home.title')}</h1>
        <p className="lead">{t('home.lead')}</p>
        <p className="hero-stats">{t('home.stats', { courses: number.format(data.courses.length), questions: number.format(totalQuestions), files: number.format(totalFiles) })}</p>
        <p className="hero-based"><Linked text={t('about.based')} links={BASED_ON_LINKS} /></p>
      </section>

      {showToday && (
        <section className="today" aria-label={t('home.today')}>
          <div className="today-stats">
            <div><b>{due.reduce((sum, [, n]) => sum + n, 0)}</b><span>{t('home.due')}</span></div>
            <div><b>{studiedToday}</b><span>{t('home.studied')}</span></div>
            <div><b>{currentStreak}</b><span>{t('home.streak')}</span></div>
          </div>
          {due.length > 0 && (
            <div className="today-links">
              {due.slice(0, 6).map(([course, n]) => (
                <Link key={course.id} className="chip link" to={`/c/${encodeURIComponent(course.id)}/study/review`}>{course.code} <b>{n}</b></Link>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="filters">
        <label className="search">
          <Search size={18} aria-hidden />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('home.search')} aria-label={t('common.search')} />
        </label>
        <div className="segmented" role="group">
          {(['all', 'questions', 'materials'] as Filter[]).map((f) => (
            <button type="button" key={f} className={filter === f ? 'on' : ''} aria-pressed={filter === f} onClick={() => setFilter(f)}>{t(`home.filter.${f}`)}</button>
          ))}
        </div>
      </div>

      {groups.length === 0 && <p className="muted">{t('home.empty')}</p>}
      {groups.map(([key, courses]) => (
        <section key={key} className="group">
          <h2>{groupLabel(key, t)}</h2>
          <div className="course-grid">
            {courses.map((c) => {
              const questions = questionCount(c);
              return (
                <Link key={c.id} to={`/c/${encodeURIComponent(c.id)}`} className="course-card">
                  <span className="course-code">{c.code}</span>
                  {c.name && <span className="course-name">{c.name}</span>}
                  <span className="course-meta">
                    {questions > 0 && <span className="has-q">{number.format(questions)} {t('course.q')}</span>}
                    {c.files && c.files.total > 0 && <span>{number.format(c.files.total)} {t(`course.f.${plural.select(c.files.total)}` as Key)}</span>}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
