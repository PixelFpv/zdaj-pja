import { ArrowLeft } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { LoadError, Loading, Message, useTitle } from '../components/Common';
import { useCourse, useCourseCards } from '../data';
import { useI18n, type Key } from '../i18n';
import { filterScope, hasKey } from '../lib/cards';
import { Flashcards } from '../modes/Flashcards';
import { Learn } from '../modes/Learn';
import { Match } from '../modes/Match';
import { OpenQuestions } from '../modes/OpenQuestions';
import { Review } from '../modes/Review';
import { Test } from '../modes/Test';
import { TrueFalse } from '../modes/TrueFalse';
import { Write } from '../modes/Write';
import type { Scope, StudyMode } from '../types';

const MODES = { flashcards: Flashcards, review: Review, learn: Learn, write: Write, test: Test, match: Match, truefalse: TrueFalse, open: OpenQuestions };

export function StudyPage() {
  const { courseId, mode } = useParams();
  const [params] = useSearchParams();
  const { t } = useI18n();
  const { course, loading, error } = useCourse(courseId);
  const { cards, loading: cardsLoading, error: cardsError } = useCourseCards(course);
  const scope = (params.get('scope') ?? 'all') as Scope;
  const off = params.get('off') ?? '';
  const Mode = mode && Object.hasOwn(MODES, mode) ? MODES[mode as StudyMode] : null;
  const label = Mode ? t(`mode.${mode}` as Key) : '';
  useTitle(course ? `${label}, ${course.code}` : undefined);

  // The pool is frozen for the session: rating a card must not rebuild it.
  const signature = cards.length > 0 ? `${course?.id}|${mode}|${scope}|${off}|${cards.length}` : '';
  const pool = useMemo(() => {
    const disabled = new Set(off.split(',').filter(Boolean));
    const inScope = filterScope(cards.filter((c) => !disabled.has(c.sourceId)), scope);
    // Questions without an answer key can only be practised in the open questions mode.
    return inScope.filter((c) => (mode === 'open' ? !hasKey(c) : hasKey(c)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (error || cardsError) return <LoadError />;
  if (loading || cardsLoading) return <Loading />;
  if (!course || !Mode) return <Message title={t('notfound')}><Link className="btn primary" to="/">{t('notfound.home')}</Link></Message>;

  const back = `/c/${encodeURIComponent(course.id)}?scope=${scope}${off ? `&off=${off}` : ''}`;

  return (
    <div className="study">
      <div className="study-head">
        <Link className="back-link" to={back}><ArrowLeft size={16} aria-hidden /> {course.code}</Link>
        <h1>{label}</h1>
      </div>
      {pool.length ? <Mode pool={pool} storageKey={`${course.id}:${scope}`} backTo={back} /> : <Message><p>{t('study.empty')}</p></Message>}
    </div>
  );
}
