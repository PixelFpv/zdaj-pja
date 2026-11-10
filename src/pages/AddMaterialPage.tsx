import { ExternalLink, Upload } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LoadError, Loading, useTitle } from '../components/Common';
import { useCatalog } from '../data';
import { useI18n } from '../i18n';
import { materialIssueUrl, pendingMaterialsUrl } from '../lib/github';
import type { MaterialCat } from '../types';

const CATS: MaterialCat[] = ['exam', 'colloquium', 'lecture', 'lab', 'other'];

export function AddMaterialPage() {
  const { t } = useI18n();
  const { data, error } = useCatalog();
  const [params, setParams] = useSearchParams();
  const [category, setCategory] = useState<MaterialCat>('colloquium');
  const courseId = params.get('course') ?? '';
  useTitle(t('amat.title'));

  if (error) return <LoadError />;
  if (!data) return <Loading />;

  const open = () => window.open(materialIssueUrl(courseId, category, t('amat.issueBody')), '_blank', 'noopener');

  return (
    <div className="narrow stack">
      <header>
        <h1>{t('amat.title')}</h1>
        <p className="lead">{t('amat.lead')}</p>
      </header>

      <div className="panel stack">
        <label className="field">
          <span className="label">{t('add.course')}</span>
          <select className="input" value={courseId} onChange={(e) => setParams(e.target.value ? { course: e.target.value } : {}, { replace: true })}>
            <option value="">{t('add.pick')}</option>
            {data.courses.map((c) => <option key={c.id} value={c.id}>{c.code}{c.name ? ` – ${c.name}` : ''}</option>)}
          </select>
        </label>
        <div className="field">
          <span className="label">{t('amat.category')}</span>
          <div className="chips">
            {CATS.map((c) => <button key={c} type="button" className={`chip ${category === c ? 'on' : ''}`} aria-pressed={category === c} onClick={() => setCategory(c)}>{t(`cat.${c}`)}</button>)}
          </div>
        </div>
        <button type="button" className="btn primary wide" disabled={!courseId} onClick={open}><Upload size={16} aria-hidden /> {t('amat.open')}</button>
        <ol className="steps">
          <li>{t('amat.step1')}</li>
          <li>{t('amat.step2')}</li>
          <li>{t('amat.step3')}</li>
        </ol>
        <p className="hint left">{t('amat.rules')}</p>
      </div>

      <a className="btn" href={pendingMaterialsUrl()} target="_blank" rel="noreferrer">{t('amat.pending')} <ExternalLink size={15} aria-hidden /></a>
    </div>
  );
}
