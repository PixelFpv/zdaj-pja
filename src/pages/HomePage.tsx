import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BASED_ON_LINKS, bankCount, Linked, LoadError, Loading, StudyLanguagePicker, useTitle } from '../components/Common';
import { useCatalog } from '../data';
import { useI18n } from '../i18n';
import { normalizeAnswer } from '../lib/text';
import { useStore } from '../store';
import type { Course, StudyLanguage } from '../types';

const SEMESTERS = ['1', '2', '3', '4', '5', '6', '7'];

const questionCount = (c: Course, language: StudyLanguage) => c.banks.reduce((sum, b) => sum + bankCount(b, language), 0);

function CourseEntry({ course, language }: { course: Course; language: StudyLanguage }) {
  const { t } = useI18n();
  const questions = questionCount(course, language);
  const files = course.files?.total ?? 0;
  const empty = !questions && !files;
  return (
    <div className={`entry ${empty ? 'empty' : ''}`}>
      <Link to={`/c/${encodeURIComponent(course.id)}`} className="entry-main">
        <span className="entry-code">{course.code}</span>
        {course.name && <span className="entry-name">{course.name}</span>}
      </Link>
      <span className="entry-meta">
        {questions > 0 && <Link className="entry-list" to={`/c/${encodeURIComponent(course.id)}?tab=questions`} title={t('home.openList')}>{questions} {t('course.q')}</Link>}
        {questions === 0 && files > 0 && <span>{t('course.onlyMaterials')}</span>}
        {empty && <span>{t('home.noContent')}</span>}
        {course.elective && <em>{t('home.elective')}</em>}
      </span>
    </div>
  );
}

export function HomePage() {
  const { t } = useI18n();
  const { data, error } = useCatalog();
  const [query, setQuery] = useState('');
  const [onlyQuestions, setOnlyQuestions] = useState(false);
  const language = useStore((s) => s.studyLang);
  const srs = useStore((s) => s.srs);
  const decks = useStore((s) => s.decks);
  useTitle(undefined);

  const visible = useMemo(() => {
    if (!data) return [];
    const needle = normalizeAnswer(query);
    return data.courses.filter((c) => {
      if (onlyQuestions && !questionCount(c, language)) return false;
      return !needle || normalizeAnswer(`${c.code} ${c.name} ${c.banks.map((b) => b.title).join(' ')}`).includes(needle);
    });
  }, [data, query, onlyQuestions, language]);

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

  const archive = visible.filter((c) => c.level === 'inz' && !c.official);
  const master = visible.filter((c) => c.level === 'mgr' && !c.official);
  const totalDue = due.reduce((sum, [, n]) => sum + n, 0);

  return (
    <>
      <header className="plan-head">
        <div>
          <h1>{t('home.title')}</h1>
          <p className="lead"><Linked text={t('home.lead')} links={{ program: [t('home.program'), data.programUrl] }} /></p>
          <p className="plan-based"><Linked text={t('about.based')} links={BASED_ON_LINKS} /></p>
        </div>
        <div className="plan-tools">
          <StudyLanguagePicker />
          <input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('home.search')} aria-label={t('common.search')} />
          <label className="check small"><input type="checkbox" checked={onlyQuestions} onChange={(e) => setOnlyQuestions(e.target.checked)} /> {t('home.onlyQuestions')}</label>
        </div>
      </header>

      {totalDue > 0 && (
        <p className="due-line">
          {t('home.dueLine', { n: totalDue })}{' '}
          {due.slice(0, 6).map(([course, n]) => (
            <Link key={course.id} to={`/c/${encodeURIComponent(course.id)}/study/review`}>{course.code} ({n})</Link>
          ))}
        </p>
      )}

      {visible.length === 0 && <p className="muted">{t('home.empty')}</p>}

      <div className="plan">
        {SEMESTERS.map((sem) => {
          const courses = visible
            .filter((c) => c.official && c.sem === sem)
            .sort((a, b) => Number(a.elective) - Number(b.elective) || questionCount(b, language) - questionCount(a, language));
          return (
            <section key={sem} className="semester" aria-label={t('home.column', { n: sem })}>
              <h2><span aria-hidden>{sem}</span><span className="sr-only">{t('home.column', { n: sem })}</span></h2>
              {courses.map((c) => <CourseEntry key={c.id} course={c} language={language} />)}
            </section>
          );
        })}
      </div>

      {archive.length > 0 && (
        <section className="shelf">
          <h2>{t('home.archive')}</h2>
          <div className="shelf-list">{archive.map((c) => <CourseEntry key={c.id} course={c} language={language} />)}</div>
        </section>
      )}
      {master.length > 0 && (
        <section className="shelf">
          <h2>{t('home.master')}</h2>
          <div className="shelf-list">{master.map((c) => <CourseEntry key={c.id} course={c} language={language} />)}</div>
        </section>
      )}
    </>
  );
}
